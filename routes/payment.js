var hyperstream = require('hyperstream');
var hyperquest = require('hyperquest');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');
var post = require('../lib/post.js');
var xtend = require('xtend');
var once = require('once');

var settings = require('../settings.js');
var stripe = require('stripe')(settings.stripe_api_key);

module.exports = function (users, auth, blob) {
    return function (req, res, m) {
        if (!m.session) {
            m.error(401, 'You must be signed in to use this page.');
        }
        else if (req.method === 'POST') {
            post(save)(req, res, m);
        }
        else { layout(auth)('payment.html', show)(req, res, m) }
    };
    
    function show (req, res, m) {
        var input = through(), output = through();
        users.get(m.session.data.id, function (err, user) {
            if (err) return m.error(err);
            input.pipe(showPayment(user, m.error)).pipe(output);
        });
        return duplexer(input, output);
    }
    
    function showPayment (user, error) {
        console.log(user);
        var cancelUrl = '/~' + user.name + '/payment/cancel';
        var props = {
            '[key=status]': (user.stripe && user.stripe.subscription_id)
                ? { _text: "You have a recurring payment set up for " + ' something ' + " every " + ' something.' }
                : { _text: "You have no recurring payments set up." },
            '[key=action]': user.payment
            ? { href: cancelUrl, _text: "cancel recurring payment" }
            : { style: "display: none" },
            '[key=cc_title]': (user.stripe && user.stripe.subscription_id)
            ? { _text: "change credit card" }
            : { _text: "credit card" },
            '[key=cc_current]': user.credit_card_last_two
            ? { _text: "Your current card is the one ending in " + 'XXXX' }
            : { _text: "Fill in your credit card info below." },
            '[id=publishableKey]': {
                value: settings.stripe_publishable_key
            }
        };

        return hyperstream(props);
        

    }
    
    function save (req, res, m) {
        users.get(m.session.data.id, function (err, user) {
            if (err) return m.error(500, err);
            if (!user) return m.error(404, 'no user data');
            
            console.log(m.params.stripeToken);

            // TODO input validation!

            if(!user.stripe || !user.stripe.customer_id) {

                stripe.customers.create({
                    description: user.name + ' | ' + user.email,
                }, function(err, customer) {
                    if(err) {
                        return m.error(500, err);
                    }
                    
                    if(!user.stripe) {
                        user.stripe = {};
                    }
                    user.stripe.customer_id = customer.id;

                    createOrUpdateSubscription(user, m, function(err, subscription) {
                        if(err) {return m.error(500, err)}
                        user.stripe.subscription_id = subscription.id;
                        postSave(user, m, res);
                    });

                });
                
            } else { // this is an existing subscription being changed
                createOrUpdateSubscription(user, m, function(err, subscription) {
                    if(err) {return m.error(500, err)}
                    user.stripe.subscription_id = subscription.id;
                    postSave(user, m, res);
                });
            }
        });
    }

    function postSave(user, m, res) {
        saveUser(user, function(err, user) {
            if(err) {return m.error(500, err)}
            res.statusCode = 302;
            res.setHeader('location', '/~' + user.name + '/payment');
            res.end('redirect');       
        });
    }

    function saveUser(user, callback) {
        user.updated = new Date().toISOString();
        users.put(user.id, user, function (err) {
            if(err) return callback(err);
            callback(null, user);
        });
    }

    function createOrUpdateSubscription(user, m, callback) {
        if(user.stripe.subscription_id) {
            var updatedFields = {};

            // If a new plan was specified
            if(m.params.subscription_plan) {
                updatedFields.plan = m.params.subscription_plan;
            }

            // If a new credit card was specified
            if(m.params.stripeToken) {
                updatedFields.source = m.params.stripeToken;
            }

            stripe.customers.updateSubscription(
                user.stripe.customer_id,
                user.stripe.subscription_id,
                updatedFields,
                callback
            );
        } else {
            stripe.customers.createSubscription(
                user.stripe.customer_id, {
                plan: m.params.subscription_plan,
                source: m.params.stripeToken
            }, callback);
        }
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
                res.setHeader('location', '/~' + doc.name);
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
