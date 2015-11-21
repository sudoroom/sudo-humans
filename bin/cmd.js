#!/usr/bin/env node

var http = require('http');
var fs = require('fs');
var path = require('path');
var alloc = require('tcp-bind');
var xtend = require('xtend');

var minimist = require('minimist');
var argv = minimist(process.argv.slice(2), {
    alias: {
        d: 'datadir', p: 'port', u: 'uid', g: 'gid',
        h: 'help', D: 'debug', S: 'settings',
    },
    default: {
        datadir: 'sudoroom-data',
        port: require('is-root')() ? 80 : 8000
    }
});
if (argv.help || argv._[0] === 'help') {
    fs.createReadStream(__dirname + '/usage.txt').pipe(process.stdout);
    return;
}

if (argv.settings) settings = require(argv.settings);
else settings = require('../settings.js');

if (argv.debug && settings.sibboleth) console.log('[sibboleth] ', settings.sibboleth);

var fd = alloc(argv.port);
if (argv.gid) process.setgid(argv.gid);
if (argv.uid) process.setgid(argv.uid);

var hyperstream = require('hyperstream');
var ecstatic = require('ecstatic')({
    root: __dirname + '/../static',
    gzip: true
});
var mkdirp = require('mkdirp');

var level = require('level');
var sublevel = require('subleveldown');
var bytewise = require('bytewise');

var dir = {
    data: path.join(argv.datadir, 'data'),
    index: path.join(argv.datadir, 'index'),
    session: path.join(argv.datadir, 'session'),
    blob: path.join(argv.datadir, 'blob')
};
mkdirp.sync(dir.blob);

var ixfeed = require('index-feed');
var ixdb = level(dir.index);
var counts = require('../lib/counts.js')(
    sublevel(ixdb, 'c', { valueEncoding: 'json' })
);
var ixf = ixfeed({
    data: level(dir.data),
    index: sublevel(ixdb, 'i'),
    valueEncoding: 'json'
});

ixf.index.add(function (row, cb) {
    if (row.value && row.value.type === 'user') {
        var ix = {
            'user.id': row.value.id,
            'user.name': row.value.name,
            'user.email': row.value.email,
            'user.member': row.value.member,
            'user.visibility': row.value.visibility
        };
        if (!row.prev) {
            counts.add({
                user: 1,
                member: row.value.member ? 1 : 0
            }, done);
        }
        else if (row.value.member !== row.prev['user.member']) {
            counts.add({
                member: row.value.member ? 1 : -1
            }, done);
        }
        else done()
        function done (err) { cb(err, ix) }
    }
    else cb()
});

var accountdown = require('accountdown');
var users = accountdown(sublevel(ixf.db, 'users'), {
    login: { basic: require('accountdown-basic') }
});

var auth = require('cookie-auth')({
    name: require('../package.json').name,
    sessions: level(dir.session)
});

var store = require('content-addressable-blob-store');
var blob = store({ path: dir.blob });

var layout = require('../lib/layout.js')(auth);

var router = require('routes')();
router.addRoute('/', layout('main.html',
    require('../routes/main.js')(ixf, counts)
));
router.addRoute('/account/create', layout('create_account.html'));
router.addRoute('/account/create/post',
    require('../routes/create_account.js')(users, auth, blob)
);
router.addRoute('/account/sign-in', layout('sign_in.html'));
router.addRoute('/account/sign-in/post', 
    require('../routes/sign_in.js')(users, auth)
);

router.addRoute('/account/password-reset', layout('password_reset.html'));
router.addRoute('/account/password-reset-success', layout('password_reset_success.html'));
router.addRoute('/account/password-reset/post', 
    require('../routes/password_reset.js')(users, ixf.index)
);

router.addRoute('/account/sign-out/:token', 
    require('../routes/sign_out.js')(auth)
);
router.addRoute('/~:name/welcome', 
                require('../routes/welcome.js')(auth, ixf, blob)
);
router.addRoute('/~:name.:ext', require('../routes/ext.js')(ixf, blob));
router.addRoute('/~:name', require('../routes/profile.js')(auth, ixf, blob));
router.addRoute('/~:name/edit',
    require('../routes/edit_profile.js')(users, auth, blob)
);
router.addRoute('/~:name/payment',
    require('../routes/payment.js')(users, auth, blob)
);

router.addRoute('/members',
    require('../routes/members.js')(users, auth, blob)
);

router.addRoute('/email/users',
    require('../routes/email_list.js')('users', ixf.index, users)
);
router.addRoute('/email/members',
    require('../routes/email_list.js')('members', ixf.index, users)
);

router.addRoute('/admin/dump',
    require('../routes/dump.js')(ixf.index, users)
);

var server = http.createServer(function (req, res) {
    var m = router.match(req.url);
    if (!m) return ecstatic(req, res);
    var rparams = {
        params: m.params,
        error: error
    };
    auth.handle(req, res, function (err, session) {
        rparams.session = session && xtend(session, { update: update });
        m.fn(req, res, rparams);
        
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
        layout('error.html', function () {
            return hyperstream({ '.error': { _text: err + '\n' } });
        })(req, res, rparams);
    }
});
server.listen({ fd: fd }, function () {
    if(argv.debug) {
        // debug mode will print plaintext passwords to stdout 
        // during account creation and password reset
        // it will however not leak credit card information 
        // since that is never sent to the server (it is only sent to stripe)
        console.log('WARNING: Debug mode enabled. Will leak private user data to stdout (though not credit card info).');
    }
    console.log('listening on :' + server.address().port);
});
