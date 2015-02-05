var through = require('through2');

module.exports = function (index, name, cb) {
    var r = index.createReadStream('user.name', {
        gte: name, lte: name, limit: 1
    });
    r.once('error', function (err) { cb(err) });
    r.pipe(through.obj(write, end));
     
    function write (row) { cb(null, row.value) }
    function end () { cb(null, null) }
};
