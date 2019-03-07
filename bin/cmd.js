#!/usr/bin/env node

var http = require('http');
var fs = require('fs');
var path = require('path');
var alloc = require('tcp-bind');
var xtend = require('xtend');
var ixfeed = require('index-feed');
var minimist = require('minimist');
var hyperstream = require('hyperstream');
var mkdirp = require('mkdirp');
var level = require('level-packager')(require('leveldown'));
var sublevel = require('subleveldown');
var counts_js = require('../lib/counts.js');
var is_root = require('is-root');
var accountdown = require('accountdown');
var accountdown_basic = require('accountdown-basic');
var store = require('content-addressable-blob-store');
var cookie_auth = require('cookie-auth');
var layout_js = require('../lib/layout.js');
var render_js = require('../lib/render.js');
var routes = require('routes');
var package = require('../package.json');

// These variables are used by the pages that show the software version info
// using layout.js and hyperstream templates.
var humans_version;
var humans_version_plain;

// This object is used by the pages that show the software version info using
// pug templates.
var software = {
  'author_name': 'sudo room',
  'author_url': 'https://sudoroom.org/',
  'name': 'sudo-humans',
  'new_issue_url': 'https://github.com/sudoroom/sudo-humans/issues/new',
  'url': 'https://github.com/sudoroom/sudo-humans'
};

// See if there is a version file available, so we can report what version of
// code is being run. The version file is written by the deploy script, and
// would be in the parent directory, if it exists at all. (__dirname is the bin
// directory where this script lives.)
var versionFile = path.join(__dirname, '..', 'version.txt');
try {
    var v = fs.readFileSync(versionFile, {encoding: 'utf-8'}).trim();
    humans_version = 'sudo-humans <a href="https://github.com/sudoroom/sudo-humans/commits/' + v;
    humans_version += '">' + v + '</a>';
    humans_version_plain = v;
    software.version = v;
    software.version_url = software.url + '/commits/' + v;
} catch (e) {
    if (e.name == 'Error' && e.message.match(/^ENOENT/)) {
        // no version file... ¯\_(ツ)_/¯
        humans_version = "sudo-humans";
        humans_version_plain = "unknown";
    } else {
        throw e;
    }
}

var argv = minimist(process.argv.slice(2), {
    alias: {
        d: 'datadir',
        D: 'debug',
        g: 'gid',
        h: 'help',
        H: 'home',
        p: 'port',
        S: 'settings',
        u: 'uid',
        M: 'migrate'
    },
    string: ['migrate'],
    default: {
        datadir: 'sudoroom-data',
        home: path.dirname(__dirname),
        port: is_root() ? 80 : 8000
    }
});
if (argv.help || argv._[0] === 'help') {
    fs.createReadStream(__dirname + '/usage.txt').pipe(process.stdout);
    return;
}

if (!argv.settings) argv.settings = argv.home + '/settings.js';
var settings = require(argv.settings);
// Send the version info along with the settings object
settings.humans_version = humans_version;

if (argv.debug) {
    settings.debug = argv.debug;
    if (settings.sibboleth) console.log('[sibboleth] ', settings.sibboleth);
}

if (argv.gid) process.setgid(argv.gid);
if (argv.uid) process.setuid(argv.uid);

var ecstatic = require('ecstatic')({
    root: __dirname + '/../static',
    gzip: true
});

var dir = {
    data: path.join(argv.home, argv.datadir, 'data'),

    // location of ixdb
    index: path.join(argv.home, argv.datadir, 'index'),

    // location of auth sessions database
    session: path.join(argv.home, argv.datadir, 'session'),

    // location of content addressable blob store
    blob: path.join(argv.home, argv.datadir, 'blob')
};
mkdirp.sync(dir.blob);

var ixdb = level(dir.index);
var counts = counts_js(
    sublevel(ixdb, 'c', { valueEncoding: 'json' })
);
var datalevel = level(dir.data)
var ixf = ixfeed({
    data: datalevel,
    index: sublevel(ixdb, 'i'),
    valueEncoding: 'json'
});

ixf.index.add(function (row, cb) {
    if (row.value && row.value.type === 'user') {

        var ix = {
            'user.id': row.value.id,
            'user.name': row.value.name,
            'user.email': row.value.email,
            'user.visibility': row.value.visibility
        };

        var isMember = false;
        var collective, isCollectiveMember, isCollectiveUser;
        var c = {};
        for(collective in settings.collectives) {
            isCollectiveMember = false;
            isCollectiveUser = false;
            ix['user.'+collective] = false;
            ix['member.'+collective] = false;
            if(row.value.collectives && row.value.collectives[collective]) {
                ix['user.'+collective] = true;
                isCollectiveUser = true;
                if(row.value.collectives[collective].privs.indexOf('member') >= 0) {
                    ix['member.'+collective] = true;
                    isMember = true;
                    isCollectiveMember = true;
                }
                if(row.value.collectives[collective].stripe && row.value.collectives[collective].stripe.customer_id) {
                    ix['user.'+collective+'.stripe_customer_id'] = row.value.collectives[collective].stripe.customer_id;
                }
            }


            if (!row.prev) {
                c['user.'+collective] = isCollectiveUser ? 1 : 0;
                c['member.'+collective] = isCollectiveMember ? 1 : 0;
            } else {
                if(isCollectiveUser !== row.prev['user.'+collective]) {

                    c['user.'+collective] = isCollectiveUser ? 1 : -1;;
                }
                if(isCollectiveMember !== row.prev['member.'+collective]) {
                    c['member.'+collective] = isCollectiveMember ? 1 : -1;
                }
            }

        }

        ix['user.member'] = isMember;

        if (!row.prev) {
            c['user'] = 1;
            c['member'] = isMember ? 1 : 0;

        }
        else if (isMember !== row.prev['user.member']) {
            c['member'] = isMember ? 1 : -1;
        }

        if(Object.keys(c).length > 0) {
            counts.add(c, done);
        } else {
            done()
        }

        function done (err) { cb(err, ix) }
    }
    else cb()
});

var users = accountdown(sublevel(ixf.db, 'users'), {
    login: { basic: accountdown_basic }
});


var auth = cookie_auth({
    name: package.name,
    sessions: level(dir.session)
});

var blob = store({ path: dir.blob });


// run database migration script
if(argv.migrate) {
    var script = require(path.resolve(argv.migrate));

    script(users, ixf, counts, blob, argv, settings, function(err) {
        if(err) {
            console.error("Migration script error:", err);
            process.exit(1);
        }
        process.exit(0);
    });

} else {

var fd = alloc(argv.port);

// layout is used to render pages using hyperstream
var layout = layout_js(auth, settings);

// render is used to render pages using pug
var render = render_js();
// data to send to the render function
var template_data = {
    software: software,
    settings: settings
};

var router = routes();
router.addRoute('/',
    layout('main.html', require('../routes/main.js')(ixf, counts, settings))
);
router.addRoute('/c/:collective',
    layout('collective.html', require('../routes/collective.js')(users, ixf, counts, settings))
);
router.addRoute('/account/create',
    require('../routes/create_account.js')(users, auth, blob, settings)
);

router.addRoute('/debug',
    require('../routes/debug.js')(ixf.index, users, auth, blob, settings)
);

router.addRoute('/account/sign-in', render('sign-in.pug', template_data));
router.addRoute('/account/sign-in/post',
    require('../routes/sign_in.js')(users, auth, settings)
);

router.addRoute('/account/password-reset', layout('password_reset.html'));
router.addRoute('/account/password-reset-success', layout('password_reset_success.html'));
router.addRoute('/account/password-reset/post',
    require('../routes/password_reset.js')(users, ixf.index, settings)
);

router.addRoute('/account/sign-out/:token',
    require('../routes/sign_out.js')(auth, settings)
);

router.addRoute('/admin/c/:collective',
    require('../routes/collective_admin.js')(ixf.index, users, auth, blob, settings)
);

router.addRoute('/admin/u/:username',
    require('../routes/user_admin.js')(ixf.index, users, auth, blob, settings)
);

router.addRoute('/~:name/welcome', 
    require('../routes/welcome.js')(auth, ixf, blob, settings)
);
router.addRoute('/~:name.:ext', require('../routes/ext.js')(ixf, blob));
router.addRoute('/~:name', require('../routes/profile.js')(ixf, blob, template_data));
router.addRoute('/~:name/edit',
    require('../routes/edit_profile.js')(users, auth, blob, settings)
);

router.addRoute('/~:name/edit/:collective',
    require('../routes/payment.js')(users, auth, blob, settings)
);


router.addRoute('/c/:collective/members',
    require('../routes/members.js')(users, auth, blob, settings)
);

router.addRoute('/c/:collective/email/users',
    require('../routes/email_list.js')('users', ixf.index, users, settings)
);
router.addRoute('/c/:collective/email/members',
    require('../routes/email_list.js')('members', ixf.index, users, settings)
);

router.addRoute('/export',
    //require('../routes/export.js')(ixdb, settings)
    require('../routes/export.js')(level(datalevel), settings)
);

var server = http.createServer(function (req, res) {
    var match = router.match(req.url);
    if (!match) return ecstatic(req, res);
    var rparams = {
        params: match.params,
        error: error
    };
    auth.handle(req, res, function (err, session) {
        rparams.session = session && xtend(session, { update: update });
        match.fn(req, res, rparams);

        function update (v, cb) {
            var data = xtend(session, { data: xtend(session.data, v) });

            auth.sessions.put(session.session, data, { valueEncoding: 'json' },
            function (err) {
                if (err) cb && cb(err)
                else cb && cb(null)
            });
        }
    });

    function error (code, err) {
        res.statusCode = code;
        if (settings.debug) console.log('error: ' + err);
        layout('error.html', function () {
            return hyperstream({ '.error': { _text: err + '\n' } });
        })(req, res, rparams);
    }
});

server.listen({ fd: fd }, function () {
    if(settings.debug) {
        // debug mode will print plaintext passwords to stdout
        // during account creation and password reset
        // it will however not leak credit card information
        // since that is never sent to the server (it is only sent to stripe)
        console.log('WARNING: Debug mode enabled. Will leak private user data to stdout (though not credit card info).');
    }
    console.log('sudo-humans version', humans_version_plain, 'started at',
        new Date().toISOString());
    console.log('listening on :' + server.address().port);
});

}
