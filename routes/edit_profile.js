var hyperstream = require('hyperstream');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');
var post = require('../lib/post.js');

module.exports = function (users, auth, blob) {
    return function (req, res, m) {
        if (!m.session) {
            m.error(401, 'You must be signed in to use this page.');
        }
        else if (req.method === 'POST') {
            post(save)(req, res, m);
        }
        else layout(auth)('edit_profile.html', show)(req, res, m)
    };
    
    function show (req, res, m) {
        var input = through(), output = through();
        users.get(m.session.data.id, function (err, user) {
            if (err) return m.error(err);
            input.pipe(showUser(user, function (err) {
                if (err) m.error(err);
            })).pipe(output)
        });
        return duplexer(input, output);
    }
    
    function showUser (user, cb) {
        return hyperstream({
            '#edit-profile': { action: '/~' + user.name + '/edit', },
            '[name=name]': { value: user.name },
            '[name=email]': { value: user.email },
            '[name=full-name]': { value: user.fullName },
            '[name=visibility]': { value: user.visibility },
            '[name=avatar]': { value: user.avatar },
            '[name=about]': readblob(user.about),
            '[name=ssh]': readblob(user.ssh),
            '[name=gpg]': readblob(user.gpg)
        });
        function readblob (hash) {
            if (!hash) return '';
            var r = blob.createReadStream(hash);
            r.on('error', cb);
            return r;
        }
    }
    
    function save (req, res, m) {
        //m.params.name
        //m.params.email
    }
};
