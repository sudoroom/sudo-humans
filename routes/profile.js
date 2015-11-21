var hyperstream = require('hyperstream');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');
var fromName = require('../lib/user_from_name.js');
var marked = require('marked');
var concat = require('concat-stream');

module.exports = function (auth, ixf, blob) {
    return function (req, res, m) {
        var input = through(), output = through();
        fromName(ixf.index, m.params.name, function (err, user) {

            if (err) return m.error(500, err)
            else if (!user) return m.error(404, 'user not found')
            else layout(auth)('profile.html', function () {
                return show(user, m);
            })(req, res, m);
        });
        return duplexer(input, output);
    };
    
    function show (user, m) {
        var props = {
            '[key=name]': { _text: user.name },
            '[key=email]': { _text: user.email },
            '[key=status]': {
                _text: user.member ? 'member' : 'comrade'
            },
            '[key=avatar]': user.avatar
                ? { src: '~' + user.name + '.png' }
                : { src: 'default.png' }
            ,
            '[key=ssh]': user.ssh
                ? { href: '~' + user.name + '.pub' }
                : { style: 'display: none' }
            ,
            '[key=pgp]': user.pgp
                ? { href: '~' + user.name + '.asc' }
                : { style: 'display: none' }
            ,
            '[key=about]': markdown(user.about)
        };

        if (!m.session || m.session.data.id !== user.id) {
            props['.edit-profile'] = { style: 'display: none;' };
        }
        else {
            props['.edit-link'] = { href: '~' + user.name + '/edit' };
        }
        return hyperstream(props);
        
        function markdown (key) {
            if (!key) return '';
            var r = blob.createReadStream(key);
            var stream = through();
            r.on('error', function (err) { m.error(500, err) });
            r.pipe(concat(function (body) {
                stream.end(marked(body.toString('utf8'), {
                    sanitize: true
                }));
            }));
            return stream;
        }
    }
};
