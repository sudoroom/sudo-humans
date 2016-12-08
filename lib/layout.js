var fs = require('fs');
var path = require('path');
var shasum = require('shasum');
var hyperstream = require('hyperstream');
var xtend = require('xtend');
var through = require('through2');

module.exports = function (auth, settings) {
    return function layout (page, fn) {
        if (!fn) fn = function () { return through() };
        return function () {
            var req = arguments[0];
            var res = arguments[1];
            var m = arguments[2];

            var collective = m.params.collective;

            res.setHeader('content-type', 'text/html');

            // Change links to use full path
            // This allows running the app in a subpath
            var p = {
                '[key=collective]': collective ? settings.collectives[collective].name : '',
                'img[src^="/"]': { src: { prepend: settings.base_url } },
                'script[src^="/"]': { src: { prepend: settings.base_url } },
                'link[href^="/"]': { href: { prepend: settings.base_url } },
                'a[href^="/"]': { href: { prepend: settings.base_url } },
                '#software-version': { _html: settings.humans_version }
            }
            var layout = read('layout.html').pipe(hyperstream(p));

            var props = { '#content': read(page).pipe(fn.apply(null, arguments)) };

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
            layout.pipe(hyperstream(props)).pipe(res);
        };
    };
};

function read (file) {
    return fs.createReadStream(path.join(__dirname, '../static', file));
}
