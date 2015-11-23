var through = require('through2');

module.exports = function(stream, each, cb) {
    
    stream.once('error', function(err) {cb(err)});

    stream.on('readable', function() {
        var row = stream.read();
        if(!row) return cb(null);
        each(row);
    });
}
