var hyperstream = require('hyperstream');
var hyperquest = require('hyperquest');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');
var post = require('../lib/post.js');
var membership = require('../lib/membership.js');
var payment = require('../lib/payment.js');
var xtend = require('xtend');
var once = require('once');

module.exports = function (users, auth, blob, settings) {
    return function (req, res, m) {
        if (!m.session) {
            m.error(401, 'You must be signed in to use this page.');
        }
        else if (req.method === 'POST') {
            post(save)(req, res, m);
        }
        else layout(auth)('edit_profile.html', show)(req, res, m)
    };
    
    function show (req, res, m) {
        var input = through(), output = through();
        users.get(m.session.data.id, function (err, user) {
            if (err) return m.error(500, err);

            payment.getLatestPayments(user, settings, function(err, payments) {
                if (err) {
                    return m.error(401, err);
                }
                input.pipe(showUser(user, payments, m.error)).pipe(output);
            });
        });
        return duplexer(input, output);
    }
    
    function showUser (user, payments, error) {

        if(!user.stripe) {
            user.stripe = {};
        }

        var paymentUrl = 'payment';
        var props = {
            '#edit-profile': { action: 'edit' },
            '[name=nym]': { value: user.name },
            '[name=email]': { value: user.email },
            '[name=full-name]': { value: user.fullName },
            '[name=about]': { _text: readblob(user.about) },
            '[key=membership]': membership.table(user, settings, {editable: true, payments: payments}),
            '[key=payment]': user.stripe.subscription_id
                ? { href: paymentUrl, _text: "Edit recurring payment" }
                : { href: paymentUrl, _text: "Set up recurring payment" }
            ,
            '[name=ssh]': { _text: readblob(user.ssh) },
            '[name=pgp]': { _text: readblob(user.pgp) },
            '[key=avatar]': user.avatar
                ? { src: '../~' + user.name + '.png' }
                : { src: '../default.png' }
        };
        var opkey = '[name=visibility] option[value="' + user.visibility + '"]';
        props[opkey] = { selected: true };
        return hyperstream(props);
        
        function readblob (hash) {
            if (!hash) return '';
            var r = blob.createReadStream(hash);
            r.on('error', error);
            return r;
        }
    }
    
    function save (req, res, m) {
        if (/\S+/.test(m.params['avatar-url'])) {
            var cb = once(function (err, id) {
                clearTimeout(to);
                if (err) return m.error(500, err)
                m.params.avatar = id;
                saveData(req, res, m);
            });
            var to = setTimeout(function () {
                cb(new Error('avatar took too long to fetch'));
            }, 15 * 1000);
            get(m.params['avatar-url'], 0, cb)
        }
        else saveData(req, res, m)
    }
    
    function saveData (req, res, m) {
        var pending = 1;
        var doc = {
            name: m.params.nym,
            email: m.params.email,
            fullName: m.params['full-name'],
            visibility: m.params.visibility,
            updated: new Date().toISOString()
        };
        if (m.params.avatar) {
            doc.avatar = m.params.avatar;
        }
        
        users.get(m.session.data.id, function (err, user) {
            if (err) return m.error(500, err);
            if (!user) return m.error(404, 'no user data');
            
            doc = xtend(user, doc);
            if (user.name !== doc.name && !m.params.password) {
                m.error(401, 'password required when updating a sudonym');
            }
            else if (user.name !== doc.name) {
                updateLogin(function (err) {
                    if (err) return m.error(500, err)
                    m.session.update({ name: doc.name }, function (err) {
                        if (err) m.error(500, err)
                        else done()
                    });
                });
            }
            else if (m.params.password) {
                updateLogin(function (err) {
                    if (err) m.error(500, err);
                    else done();
                });
            }
            else done();
        });
        wsave('about');
        wsave('ssh');
        wsave('pgp');
        
        function updateLogin (cb) {
            var id = m.session.data.id;
            users.removeLogin(id, 'basic', function (err) {
                if (err) return cb(err);
                users.addLogin(id, 'basic', {
                    username: m.params.nym,
                    password: m.params.password
                }, cb);
            });
        }
        
        function wsave (key) {
            pending ++;
            if (!/\S/.test(m.params[key])) return done();
            blob.createWriteStream().end(m.params[key], function () {
                doc[key] = this.key;
                done();
            });
        }
        function done () {
            if (-- pending !== 0) return;
            users.put(m.session.data.id, doc, function (err) {
                if (err) return m.error(500, err);
                res.statusCode = 302;
                res.setHeader('location', '../~' + doc.name);
                res.end('redirect');
            });
        }
    }
    
    function get (u, hops, cb) {
        if (hops > 3) {
            return cb(new Error('too many redirects fetching avatar'));
        }
        var hq = hyperquest.get(u);
        
        var size = 0;
        hq.pipe(through(function (buf, enc, next) {
            size += buf.length;
            if (size >= 1024 * 300) { // 300kb
                cb(new Error('Avatar image too big. Must be < 300kb'));
            }
            else next();
        }));
        
        hq.on('error', cb);
        hq.on('response', function (res) {
            if (/^3/.test(res.statusCode)) {
                get(res.headers.location, hops + 1, cb);
            }
            else if (/^2/.test(res.statusCode)) {
                var w = hq.pipe(blob.createWriteStream());
                w.on('finish', function () { cb(null, w.key) });
            }
            else cb(new Error('error fetching avatar: ' + res.statusCode))
        });
    }
};
