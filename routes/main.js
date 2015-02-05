var through = require('through2');
var template = require('html-template');

module.exports = function (users) {
    return function (req, req, m) {
        var html = template();
        var member = html.template('member');
        users.list().pipe(through.obj(function (row, enc, next) {
            var name = row.value.name;
            this.push({
                'a': { href: '/~' + name },
                'img.avatar': { src: '/~' + name + '.png' },
                '.name': { _text: name }
            });
            next();
        })).pipe(member);
        return html;
    };
};
