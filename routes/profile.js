var hyperstream = require('hyperstream');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');

module.exports = function (auth, ixf) {
    return layout(auth)('profile.html', function (req, res, m) {
        var r = ixf.index.createReadStream('user.name', {
            gte: m.params.name, lte: m.params.name, limit: 1
        });
        r.once('error', function (err) { show(err) });
        r.pipe(through.obj(write, end));
        var input = through(), output = through();
        return duplexer(input, output);
        
        function write (row) {
            var props = {
                '[key=name]': { _text: row.value.name },
                '[key=status]': {
                    _text: row.value.member ? 'member' : 'comrade'
                }
            };
            if (!m.session || m.session.data.id !== row.value.id) {
                props['.edit-profile'] = { style: 'display: none;' };
            }
            else {
                props['.edit-link'] = { href: '/~' + row.value.name + '/edit' };
            }
            input.pipe(hyperstream(props)).pipe(output);
        }
        function end () { show('user not found') }
        
        function show (msg) {
            input.pipe(hyperstream({
                '.name': { _text: msg }
            })).pipe(output);
        }
    });
};
