var post = require('../lib/post.js');

module.exports = function (users, auth, settings) {
    return post(function (req, res, m) {
        var creds = { username: m.params.name, password: m.params.password };
        users.verify('basic', creds, function (err, ok, id) {
            if (err) {
                console.log('[err] Unexpected error verifying credentials');
                m.error(500, err);
            } else if (!ok) {
                console.log('[info] Failed login for user: ', m.params.name);
                m.error(401, 'invalid name or password');
            }
            else {
                console.log('[info] Successful login for user: ', m.params.name);
                auth.login(res, { id: id, name: m.params.name }, onlogin);
            }
        });
        function onlogin (err, session) {
            if (err) return m.error(400, err);
            res.writeHead(303, { location: settings.base_url + '/' });
            res.end();
        }
    });
};
