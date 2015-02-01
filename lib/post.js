var body = require('body/any');
var xtend = require('xtend');

module.exports = function post (fn) {
    return function (req, res, m) {
        if (req.method !== 'POST') {
            res.statusCode = 400;
            res.end('not a POST\n');
        }
        else body(req, res, function (err, pvars) {
            fn(req, res, xtend(m, { params: xtend(pvars, m.params) }));
        });
    };
};
