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
var duplexer = require('duplexer2');
var shasum = require('shasum');
var mkdirp = require('mkdirp');
var template = require('html-template');

var level = require('level');
var sublevel = require('subleveldown');

var dir = {
    data: path.join(argv.datadir, 'data'),
    index: path.join(argv.datadir, 'index'),
    session: path.join(argv.datadir, 'session')
};
mkdirp.sync(dir.data);

var ixfeed = require('index-feed');
var ixf = ixfeed({
    data: level(dir.data),
    index: level(dir.index),
    valueEncoding: 'json'
});

ixf.index.add(function (row, cb) {
console.log(row);
    if (row.value && row.value.type === 'user') {
        cb(null, {
            'user.name': row.value.name,
            'user.member': row.value.member,
            'user.visibility': row.value.visibility
        });
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
router.addRoute('/account/create/post', post(function (req, res, m) {
    var id = crypto.randomBytes(16).toString('hex');
    var opts = {
        login: {
            basic: {
                username: m.params.name,
                password: m.params.password
            }
        },
        value: {
            type: 'user',
            id: id,
            member: false,
            name: m.params.name,
            visibility: m.params.visibility
        }
    };
    users.create(id, opts, function (err) {
        if (err) return m.error(400, err);
        auth.login(res, { id: id, name: m.params.name }, onlogin);
    });
    function onlogin (err, session) {
        if (err) return m.error(400, err);
        res.writeHead(303, { location: '/account/welcome' });
        res.end();
    }
}));
router.addRoute('/account/sign-in', layout('sign_in.html'));
router.addRoute('/account/sign-in/post', post(function (req, res, m) {
    var creds = { username: m.params.name, password: m.params.password };
    users.verify('basic', creds, function (err, ok, id) {
        if (err) m.error(500, err);
        else if (!ok) m.error(401, 'invalid name or password');
        else auth.login(res, { id: id, name: m.params.name }, onlogin);
    });
    function onlogin (err, session) {
        if (err) return m.error(400, err);
        res.writeHead(303, { location: '/' });
        res.end();
    }
}));
router.addRoute('/account/sign-out/:token', function (req, res, m) {
    auth.handle(req, res, function (err, session) {
        if (session && shasum(session.session) === m.params.token) {
            auth.delete(req, function (err) {
                if (err) m.error(500, err);
                else done()
            });
        }
        else if (session) {
            m.error(401, 'sign out token mismatch');
        }
        else done()
    });
    function done () {
        res.writeHead(303, { location: '/' });
        res.end();
    }
});
router.addRoute('/account/welcome', layout('welcome.html'));
router.addRoute('/~:name', layout('profile.html', function (req, res, m) {
    var r = ixf.index.createReadStream('user.name', {
        gte: m.params.name, lte: m.params.name, limit: 1
    });
    r.once('error', function (err) { show(err) });
    r.pipe(through.obj(write, end));
    var input = through(), output = through();
    return duplexer(input, output);
    
    function write (row) {
        var props = {
            '.name': { _text: row.value.name },
            '.status': { _text: row.value.member ? 'member' : 'comrade' }
        };
        if (!m.session || m.session.data.id !== row.value.id) {
            props['.edit-profile'] = null;
        }
        else {
            props['.edit-link'] = { href: '/~' + row.value.name + '/edit' };
        }
        input.pipe(hyperstream(props)).pipe(output);
    }
    function end () { show('user not found') }
    
    function show (msg) {
        input.pipe(hyperstream({
            '.name': { _text: msg }
        })).pipe(output);
    }
}));

var server = http.createServer(function (req, res) {
    var m = router.match(req.url);
    if (m) m.fn(req, res, { params: m.params, error: error });
    else ecstatic(req, res);
    
    function error (code, err) {
        res.statusCode = code;
        layout('error.html', function () {
            return hyperstream({ '.error': { _text: err + '\n' } });
        })(req, res);
    }
});
server.listen({ fd: fd }, function () {
    console.log('listening on :' + server.address().port);
});

function read (file) {
    return fs.createReadStream(path.join(__dirname, '../static', file));
}

function layout (page, fn) {
    if (!fn) fn = function () { return through() };
    return function (req, res, m) {
        res.setHeader('content-type', 'text/html');
        auth.handle(req, res, function (err, session) {
            var props = { '#content': read(page).pipe(fn(req, res, m)) };
            if (session) {
                m.session = session;
                var token = shasum(session.session);
                var name = session.data.name;
                props = xtend(props, {
                    '.signed-out': { style: 'display: none' },
                    '.sign-out-link': { href: { append: token } },
                    '.profile-link': { href: { append: name } },
                    '.name': { _text: name }
                });
            }
            else {
                props['.signed-in'] = { style: 'display: none' };
            }
            read('layout.html').pipe(hyperstream(props)).pipe(res);
        });
    };
}

function post (fn) {
    return function (req, res, m) {
        if (req.method !== 'POST') {
            res.statusCode = 400;
            res.end('not a POST\n');
        }
        else body(req, res, function (err, pvars) {
            fn(req, res, xtend(m, { params: xtend(pvars, m.params) }));
        });
    };
}
