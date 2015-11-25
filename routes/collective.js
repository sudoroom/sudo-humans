var through = require('through2');
var duplexer = require('duplexer2');
var template = require('html-template');
var combine = require('stream-combiner2');
var hyperstream = require('hyperstream');
var timeago = require('timeago');
var membership = require('../lib/membership.js');

module.exports = function (users, ixf, counts, settings) {
    return function (req, res, m) {

        if(!settings.collectives[m.params.collective]) return m.error("Collective not found");
        var collective = m.params.collective;

        var comrades = ixf.index.createReadStream('user.'+collective, { eq: true });
        var members = ixf.index.createReadStream('member.'+collective, { eq: true });
        var feed = ixf.feed.createReadStream({ reverse: true });
        
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
            var opts = {
                '[key=member-count]': c['member.'+collective] || 0,
                '[key=user-count]': c['user.'+collective] || 0,
                '[key=collective]': settings.collectives[collective].name,
                '[key=members-email-link]': { href: collective+'/email/members' },
                '[key=users-email-link]':{ href: collective+'/email/users' },
            };
            
            var userID;
            if(m.session && m.session.data && m.session.data.id) {
                users.get(m.session.data.id, function (err, user) {
                    if(!err && user && user.collectives && user.collectives[collective]) {
                        opts['[key=admin-link]'] = { 
                            href: '../admin/c/'+collective,
                            _text: "Administrate this collective"
                        };
                    }
                
                    input.pipe(hyperstream(opts)).pipe(output);
                });    
            } else {
                input.pipe(hyperstream(opts)).pipe(output);
            }

        });
        
        var modify = duplexer(input, output);
        return combine(modify, html);
        
        function write (row, enc, next) {
            var name = row.value.name;
            this.push({
                '[key=link]': { href: '../~' + name },
                '[key=avatar]': { src: '../~' + name + '.png' },
                '[key=name]': { _text: name }
            });
            next();
        }
        
        function ewrite (update, enc, next) {
            var self = this;
            var limit = 5;
            
            update.value.map(function (row) {
                if (self.count >= limit) return;
                if (row.type === 'put' && row.value
                && row.value.type === 'user') {
                    if(!row.value.collectives || !row.value.collectives[collective]) {
                        return;
                    }
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
                '[key=name]': { _text: name, href: '../~' + name },
                '[key=msg]': { _text: msg },
                '[key=ago]': { _text: timeago(user.updated) },
                '[key=date]': { _text: user.updated }
            };
        }
    };
};
