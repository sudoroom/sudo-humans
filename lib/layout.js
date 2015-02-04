var fs = require('fs');
var path = require('path');
var shasum = require('shasum');
var hyperstream = require('hyperstream');
var xtend = require('xtend');
var through = require('through2');

module.exports = function (auth) {
    return function layout (page, fn) {
        if (!fn) fn = function () { return through() };
        return function (req, res, m) {
            res.setHeader('content-type', 'text/html');
            var props = { '#content': read(page).pipe(fn(req, res, m)) };
            
            if (m.session) {
                var token = shasum(m.session.session);
                var name = m.session.data.name;
                props = xtend(props, {
                    '.signed-out': { style: 'display: none' },
                    '.sign-out-link': { href: { append: token } },
                    '.profile-link': { href: { append: name } },
                    '.name': { _text: name }
                });
            }
            else {
                props['.signed-in'] = { style: 'display: none' };
            }
            read('layout.html').pipe(hyperstream(props)).pipe(res);
        };
    };
};

function read (file) {
    return fs.createReadStream(path.join(__dirname, '../static', file));
}
