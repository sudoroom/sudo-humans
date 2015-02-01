#!/usr/bin/env node

var http = require('http');
var fs = require('fs');
var path = require('path');
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
var xtend = require('xtend');
var through = require('through2');
var shasum = require('shasum');
var mkdirp = require('mkdirp');

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
router.addRoute('/', layout('main.html', require('../routes/main.js')(users)));
router.addRoute('/account/create', layout('create_account.html'));
router.addRoute('/account/create/post',
    require('../routes/create_account.js')(users, auth)
);
router.addRoute('/account/sign-in', layout('sign_in.html'));
router.addRoute('/account/sign-in/post', 
    require('../routes/sign_in.js')(users, auth)
);
router.addRoute('/account/sign-out/:token', 
    require('../routes/sign_out.js')(auth)
);
router.addRoute('/account/welcome', layout('welcome.html'));
router.addRoute('/~:name', layout(
    'profile.html', require('../routes/profile.js')(ixf)
));

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
