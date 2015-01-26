var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

var hyperstream = require('hyperstream');
var ecstatic = require('ecstatic')({
    root: __dirname + '/static',
    gzip: true
});

var minimist = require('minimist');
var argv = minimist(process.argv.slice(2), {
    alias: { d: 'datadir' },
    default: { datadir: path.join(__dirname, 'sudoroom-data') }
});

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
server.listen(7000);

function read (file) {
    return fs.createReadStream(path.join(__dirname, 'static', file));
}
