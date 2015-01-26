var http = require('http');
var fs = require('fs');
var hyperstream = require('hyperstream');
var ecstatic = require('ecstatic')({
    root: __dirname + '/static',
    gzip: true
});
var persona = require('persona-id')('http://localhost:7000');

var sessions = {};
persona.on('create', function (sid, id) {
    sessions[sid] = id.email;
});

persona.on('destroy', function (sid) {
    delete sessions[sid];
});

var server = http.createServer(function (req, res) {
    if (persona.test(req)) {
        persona.handle(req, res);
    }
    else if (req.url === '/') {
        var sid = persona.getId(req);
        res.setHeader('content-type', 'text/html');
        fs.createReadStream(__dirname + '/static/index.html')
            .pipe(hyperstream({ '#name': sessions[sid] || '' }))
            .pipe(res)
        ;
    }
    else ecstatic(req, res);
});
server.listen(7000);
