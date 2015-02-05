module.exports = function (db) {
    return { add: add, get: get };
    
    function add (values, cb) {
        get(function (err, cur) {
            if (!cur) cur = {};
            Object.keys(values).forEach(function (key) {
                cur[key] = Number(cur[key] || 0) + Number(values[key]);
            });
            db.put('counts', cur, cb);
        });
    }
    function get (cb) {
        db.get('counts', function (err, counts) {
            if (err && err.type === 'NotFoundError') cb(null, {})
            else cb(err, counts)
        });
    }
};
