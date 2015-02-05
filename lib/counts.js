module.exports = function (db) {
    return { add: add, get: get };
    
    function add (values, cb) {
        var keys = Object.keys(values);
        get(keys, function (err, cur) {
            if (!cur) cur = {};
            Object.keys(values).forEach(function (key) {
                cur[key] = Number(cur[key] || 0) + Number(values[key]);
            });
            db.put('counts', cur, cb);
        });
    }
    function get (keys, cb) {
        db.get('counts', function (err, counts) {
            if (err && err.type === 'NotFoundError') cb(null, {})
            else cb(err, counts)
        });
    }
};
