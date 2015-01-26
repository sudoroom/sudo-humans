var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');
var alloc = require('tcp-bind');

var minimist = require('minimist');
var argv = minimist(process.argv.slice(2), {
    alias: { d: 'datadir', p: 'port', u: 'uid', g: 'gid' },
    default: {
        datadir: path.join(__dirname, 'sudoroom-data'),
        port: require('is-root')() ? 80 : 8000
    }
});

var fd = alloc(argv.port);
if (argv.gid) process.setgid(argv.gid);
if (argv.uid) process.setgid(argv.uid);

var hyperstream = require('hyperstream');
var ecstatic = require('ecstatic')({
    root: __dirname + '/static',
    gzip: true
});
var body = require('body/any');
var xtend = require('xtend');

var level = require('level');
var db = level(argv.datadir, { valueEncoding: 'json' });

var server = http.createServer(function (req, res) {
    var u = url.parse(req.url);
    if (u.pathname === '/') {
        layout('main.html');
    }
    else if (u.pathname === '/account/create') {
        layout('create_account.html');
    }
    else if (u.pathname === '/account/sign-in') {
        layout('sign_in.html');
    }
    else ecstatic(req, res);
    
    function layout (page) {
        res.setHeader('content-type', 'text/html');
        read('layout.html')
            .pipe(hyperstream({ '#content': read(page) }))
            .pipe(res)
        ;
    }
});
server.listen({ fd: fd }, function () {
    console.log('listening on :' + server.address().port);
});

function read (file) {
    return fs.createReadStream(path.join(__dirname, 'static', file));
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
