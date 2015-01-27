#!/usr/bin/env node

var http = require('http');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var alloc = require('tcp-bind');

var minimist = require('minimist');
var argv = minimist(process.argv.slice(2), {
    alias: {
        d: 'datadir', p: 'port', u: 'uid', g: 'gid',
        h: 'help'
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

var fd = alloc(argv.port);
if (argv.gid) process.setgid(argv.gid);
if (argv.uid) process.setgid(argv.uid);

var hyperstream = require('hyperstream');
var ecstatic = require('ecstatic')({
    root: __dirname + '/../static',
    gzip: true
});
var body = require('body/any');
var xtend = require('xtend');
var through = require('through2');
var shasum = require('shasum');
var mkdirp = require('mkdirp');
var template = require('html-template');

var level = require('level');
var sublevel = require('subleveldown');
var changesdown = require('changesdown');
var changes = require('changes-feed');
var chproc = require('level-change-processor');

var dir = {
    db: path.join(argv.datadir, 'db'),
    ch: path.join(argv.datadir, 'changes')
};
mkdirp.sync(dir.db);
mkdirp.sync(dir.ch);

var up = level(dir.db, { valueEncoding: 'json' });
var feed = changes(sublevel(up, 'ch'));
var db = changesdown(sublevel(up, 'db'), feed);

/*
feed.createReadStream({ live: true })
    .on('data', function (data) {
        console.log(changesdown.decode(data));
    })
;
*/

var accountdown = require('accountdown');
var users = accountdown(sublevel(db, 'users'), {
    login: { basic: require('accountdown-basic') }
});

var auth = require('cookie-auth')({
    name: require('../package.json').name,
    sessions: sublevel(db, 'sessions')
});

var router = require('routes')();
router.addRoute('/', layout('main.html', function (req) {
    var html = template();
    var member = html.template('member');
    users.list().pipe(through.obj(function (row, enc, next) {
        var name = row.value.name;
        this.push({
            'img.avatar': { src: 'https://github.com/' + name + '.png' },
            '.name': { _text: name }
        });
        next();
    })).pipe(member);
    return html;
}));
router.addRoute('/account/create', layout('create_account.html'));
router.addRoute('/account/create/post', post(function (req, res, params) {
    var id = crypto.randomBytes(16).toString('hex');
    var opts = {
        login: { basic: { username: params.name, password: params.password } },
        value: {
            member: false,
            visibility: params.visibility
        }
    };
    users.create(id, opts, function (err) {
        if (err) return error(res, 400, err);
        auth.login(res, { id: id, name: params.name }, onlogin);
    });
    function onlogin (err, session) {
        if (err) return error(res, 400, err);
        res.writeHead(303, { location: '/account/welcome' });
        res.end();
    }
}));
router.addRoute('/account/sign-in', layout('sign_in.html'));
router.addRoute('/account/sign-in/post', post(function (req, res, params) {
    var creds = { username: params.name, password: params.password };
    users.verify('basic', creds, function (err, ok, id) {
        if (err) error(res, 500, err);
        else if (!ok) error(res, 401, 'invalid name or password');
        else auth.login(res, { id: id, name: params.name }, onlogin);
    });
    function onlogin (err, session) {
        if (err) return error(res, 400, err);
        res.writeHead(303, { location: '/' });
        res.end();
    }
}));
router.addRoute('/account/sign-out/:token', function (req, res, params) {
    auth.handle(req, res, function (err, session) {
        if (session && shasum(session.session) === params.token) {
            auth.delete(req, function (err) {
                if (err) error(res, 500, err);
                else done()
            });
        }
        else if (session) {
            error(res, 401, 'sign out token mismatch');
        }
        else done()
    });
    function done () {
        res.writeHead(303, { location: '/' });
        res.end();
    }
});
router.addRoute('/account/welcome', layout('welcome.html'));
router.addRoute('/~:name', layout('profile.html', function (req, res, params) {
    var stream = through();
    stream.pipe(hyperstream({ '.name': { _text: params.name } }));
    names.get(params.name, function (err, id) {
        if (err) error(res, 500, err)
        else users.get(id, onget)
    });
    return stream;
    
    function onget (err, value) {
        if (err) return error(res, 404, err);
        
        //stream.end({});
    }
}));

var server = http.createServer(function (req, res) {
    var m = router.match(req.url);
    if (m) m.fn(req, res, m.params);
    else ecstatic(req, res);
});
server.listen({ fd: fd }, function () {
    console.log('listening on :' + server.address().port);
});

function read (file) {
    return fs.createReadStream(path.join(__dirname, '../static', file));
}

function layout (page, fn) {
    if (!fn) fn = function () { return through() };
    return function (req, res, params) {
        res.setHeader('content-type', 'text/html');
        auth.handle(req, res, function (err, session) {
            var props = { '#content': read(page).pipe(fn(req, res, params)) };
            if (session) {
                var token = shasum(session.session);
                var name = session.data.name;
                props['.signed-out'] = { style: 'display: none' };
                props['.sign-out-link'] = { href: { append: token } };
                props['.profile-link'] = { href: { append: name } };
                props['.name'] = { _text: name };
            }
            else {
                props['.signed-in'] = { style: 'display: none' };
            }
            read('layout.html').pipe(hyperstream(props)).pipe(res);
        });
    };
}

function post (fn) {
    return function (req, res, params) {
        if (req.method !== 'POST') {
            res.statusCode = 400;
            res.end('not a POST\n');
        }
        else body(req, res, function (err, pvars) {
            fn(req, res, xtend(pvars, params));
        });
    };
}

function error (res, code, err) {
    res.statusCode = code;
    layout('error.html', function () {
        return hyperstream({ '.error': { _text: err + '\n' } });
    })(null, res);
}
