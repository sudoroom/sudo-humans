var post = require('../lib/post.js');
var crypto = require('crypto');
var sublevel = require('subleveldown');
var bytewise = require('bytewise');

module.exports = function (users, auth) {
    return post(function (req, res, m) {
    var id = crypto.randomBytes(16).toString('hex');
        var opts = {
            login: {
                basic: {
                    username: m.params.name,
                    password: m.params.password
                }
            },
            value: {
                type: 'user',
                id: id,
                name: m.params.name,
                email: m.params.email,
                fullName: m.params['full-name'],
                member: false,
                visibility: m.params.visibility
            }
        };
        users.create(id, opts, function (err) {
            if (err) return m.error(400, err);
            auth.login(res, { id: id, name: m.params.name }, onlogin);
        });
        function onlogin (err, session) {
            if (err) return m.error(400, err);
            res.writeHead(303, { location: '/account/welcome' });
            res.end();
        }
    });
};
