var hyperstream = require('hyperstream');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');
var fromName = require('../lib/user_from_name.js');

module.exports = function (auth, ixf) {
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
            '[key=status]': {
                _text: user.member ? 'member' : 'comrade'
            },
            '[key=ssh]': user.ssh
                ? { href: '/~' + user.name + '.pub' }
                : { style: 'display: none' }
            ,
            '[key=gpg]': user.gpg
                ? { href: '/~' + user.name + '.asc' }
                : { style: 'display: none' }
            ,
        };
        if (!m.session || m.session.data.id !== user.id) {
            props['.edit-profile'] = { style: 'display: none;' };
        }
        else {
            props['.edit-link'] = { href: '/~' + user.name + '/edit' };
        }
        return hyperstream(props);
    }
};
