var http = require('http');
var fs = require('fs');
var path = require('path');
var hyperstream = require('hyperstream');
var ecstatic = require('ecstatic')({
    root: __dirname + '/static',
    gzip: true
});

var server = http.createServer(function (req, res) {
    if (req.url === '/') {
        layout('index.html');
    }
    else if (req.url === '/account/create') {
        layout('create_account.html');
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
