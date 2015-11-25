var hyperstream = require('hyperstream');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');
var fromName = require('../lib/user_from_name.js');
var marked = require('marked');
var concat = require('concat-stream');

module.exports = function (auth, ixf, blob, settings) {
    return function (req, res, m) {
        var input = through(), output = through();
        fromName(ixf.index, m.params.name, function (err, user) {

            if (err) return m.error(500, err)
            else if (!user) return m.error(404, 'user not found')
            else layout(auth, settings)('welcome.html', function () {
                return show(user, m);
            })(req, res, m);
        });
        return duplexer(input, output);
    };
    
    function show (user, m) {

        var mhtml = '';
        var col;
        for(col in user.collectives) {
            mhtml += '<li>Set up <a href="edit/'+col+'">recurring payments for '+settings.collectives[col].name+'</a></li>\n';
        }

        var props = {
            '[key=profile-edit]': { href: '../~' + user.name + '/edit'},
            '[key=links]': { _appendHtml: mhtml }
        };

        return hyperstream(props);

    }
};
