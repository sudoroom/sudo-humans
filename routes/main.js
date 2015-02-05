var through = require('through2');
var template = require('html-template');

module.exports = function (index) {
    return function (req, req, m) {
        var comrades = index.createReadStream('user.member', {
            gte: false, lte: false
        });
        var members = index.createReadStream('user.member', {
            gte: true, lte: true
        });
        
        var html = template();
        var member = html.template('member');
        var comrade = html.template('comrade');
        
        members.pipe(through.obj(write)).pipe(member);
        comrades.pipe(through.obj(write)).pipe(comrade);
        return html;
        
        function write (row, enc, next) {
            var name = row.value.name;
            this.push({
                'a': { href: '/~' + name },
                'img.avatar': { src: '/~' + name + '.png' },
                '.name': { _text: name }
            });
            next();
        }
    };
};
