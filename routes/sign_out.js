var shasum = require('shasum');

module.exports = function (auth, settings) {
    return function (req, res, m) {
        auth.handle(req, res, function (err, session) {
            if (session && shasum(session.session) === m.params.token) {
                auth.delete(req, function (err) {
                    if (err) m.error(500, err);
                    else done()
                });
            }
            else if (session) {
                m.error(401, 'sign out token mismatch');
            }
            else done()
        });
        function done () {
            res.writeHead(303, { location: settings.base_url + '/' });
            res.end();
        }
    };
};
