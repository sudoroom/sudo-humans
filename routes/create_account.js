var post = require('../lib/post.js');
var crypto = require('crypto');
var sublevel = require('subleveldown');
var bytewise = require('bytewise');
var retricon = require('retricon');

module.exports = function (users, auth, blob) {
    return post(function (req, res, m) {
        var id = crypto.randomBytes(16).toString('hex');
        var img = retricon(id, { pixelSize: 15, tiles: 5 });
        var w = img.pngStream().pipe(blob.createWriteStream());
        w.on('error', function (err) { m.error(500, err) });
        w.once('finish', function () { create(res, m, id, w.key) });
    });
    
    function create (res, m, id, avatar) {
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
                visibility: m.params.visibility,
                avatar: avatar
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
    }
};
