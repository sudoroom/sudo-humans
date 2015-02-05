var through = require('through2');
var duplexer = require('duplexer2');
var template = require('html-template');
var combine = require('stream-combiner2');
var hyperstream = require('hyperstream');

module.exports = function (ixf, counts) {
    return function (req, req, m) {
        var comrades = ixf.index.createReadStream('user.member', { eq: false });
        var members = ixf.index.createReadStream('user.member', { eq: true });
        
        var html = template();
        var member = html.template('member');
        var comrade = html.template('comrade');
        
        members.pipe(through.obj(write)).pipe(member);
        comrades.pipe(through.obj(write)).pipe(comrade);
        
        var input = through(), output = through();
        counts.get(function (err, c) {
            input.pipe(hyperstream({
                '[key=member-count]': c.member || 0,
                '[key=user-count]': c.user || 0
            })).pipe(output);
        });
        
        var modify = duplexer(input, output);
        return combine(modify, html);
        
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
