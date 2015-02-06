var through = require('through2');
var duplexer = require('duplexer2');
var template = require('html-template');
var combine = require('stream-combiner2');
var hyperstream = require('hyperstream');
var timeago = require('timeago');

module.exports = function (ixf, counts) {
    return function (req, req, m) {
        var comrades = ixf.index.createReadStream('user.member', { eq: false });
        var members = ixf.index.createReadStream('user.member', { eq: true });
        var feed = ixf.index.createReadStream('feed');
        
        var html = template();
        var member = html.template('member');
        var comrade = html.template('comrade');
        var event = html.template('event');
        
        members.pipe(through.obj(write)).pipe(member);
        comrades.pipe(through.obj(write)).pipe(comrade);
        feed.pipe(through.obj(ewrite)).pipe(event);
        
        var input = through(), output = through();
        counts.get(function (err, c) {
            if (err) return m.error(err);
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
                '[key=link]': { href: '/~' + name },
                '[key=avatar]': { src: '/~' + name + '.png' },
                '[key=name]': { _text: name }
            });
            next();
        }
        
        function ewrite (row, enc, next) {
            var name = row.value.name;
            var msg = row.index[1]
                ? 'updated their profile'
                : 'created an account'
            ;
            this.push({
                '[key=name]': { _text: name, href: '/~' + name },
                '[key=msg]': { _text: msg },
                '[key=date]': { _text: timeago(row.value.updated) }
            });
            next();
        }
    };
};
