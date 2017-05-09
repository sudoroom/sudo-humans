var through = require('through2');
var duplexer = require('duplexer2');
var template = require('html-template');
var combine = require('stream-combiner2');
var hyperstream = require('hyperstream');
var timeago = require('timeago');
var membership = require('../lib/membership.js');

module.exports = function (ixf, counts, settings) {
    return function (req, res, m) {
        var feed = ixf.feed.createReadStream({ reverse: true });
        
        var html = template();
        var event = html.template('event');
        
        feed.pipe(through.obj(ewrite)).pipe(event);

        var input = through(), output = through();
        counts.get(function (err, c) {
            if (err) return m.error(err);
            input.pipe(hyperstream({
                '[key=collectives]': membership.collectiveNamesSentence(settings),
                '[key=collectives-list]': Object.keys(settings.collectives).map(function(collective) {
                    return '<li><a href="c/'+collective+'">'+settings.collectives[collective].name+'</a></li>';
                }).join("\n"),
                '[key=member-count]': c.member || 0,
                '[key=user-count]': c.user || 0
            })).pipe(output);
        });
        
        var modify = duplexer(input, output);
        return combine(modify, html);
        
        function ewrite (update, enc, next) {
            var self = this;
            var limit = 5;
            
            update.value.map(function (row) {
                if (self.count >= limit) return;
                if (row.type === 'put' && row.value
                && row.value.type === 'user') {
                    self.push(userUpdate(row.value));
                    self.count = (self.count || 0) + 1;
                }
            });
            if (self.count < limit) next()
            else self.push(null)
        }
        
        function userUpdate (user) {
            var name = user.name;
            var msg = user.created === user.updated
                ? 'created an account'
                : 'updated their profile'
            ;
            return {
                '[key=name]': { _text: name, href: '~' + name },
                '[key=msg]': { _text: msg },
                '[key=ago]': { _text: timeago(user.updated) },
                '[key=date]': { _text: user.updated }
            };
        }
    };
};
