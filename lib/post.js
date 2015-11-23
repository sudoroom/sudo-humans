var body = require('body/any');
var xtend = require('xtend');

module.exports = function post (fn) {
    return function () {
        var args = arguments;
        var req = args[0];
        var res = args[1];
        if (req.method !== 'POST') {
            res.statusCode = 400;
            res.end('not a POST\n');
        }
        else body(req, res, function (err, pvars) {
            args[2] = xtend(args[2], { params: xtend(pvars, args[2].params)});
            fn.apply(null, args);
        });
    };
};
