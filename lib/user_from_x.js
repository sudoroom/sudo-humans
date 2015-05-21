var through = require('through2');

module.exports = function (index, key, val, cb) {
    var r = index.createReadStream('user.' + key, {
        gte: val, lte: val, limit: 1
    });
    r.once('error', function (err) { cb(err) });
    r.pipe(through.obj(write, end));
     
    function write (row) { cb(null, row.value) }
    function end () { cb(null, null) }
};
