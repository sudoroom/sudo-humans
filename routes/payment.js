var hyperstream = require('hyperstream');
var hyperquest = require('hyperquest');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');
var post = require('../lib/post.js');
var xtend = require('xtend');
var once = require('once');

var Stripe = require('stripe');

module.exports = function (users, auth, blob, settings) {
    return function (req, res, m) {
        if (!m.session) {
            m.error(401, 'You must be signed in to use this page.');
        }

        var stripe = Stripe(settings.stripe_api_key);

        if (req.method === 'POST') {
            post(save)(req, res, m, stripe);
        }
        else { layout(auth, settings)('payment.html', show)(req, res, m) }
    };
    
    function show (req, res, m) {
        var input = through(), output = through();
        users.get(m.session.data.id, function (err, user) {
            if (err) return m.error(err);
            computeStream(user, m.error, stripe, function(hypstr) {
                input.pipe(hypstr).pipe(output);
            });
        });
        return duplexer(input, output);
    }
    
    function computeStream(user, error, stripe, cb) {

        stripe.plans.list({limit: 50}, function(err, plans) {
            if(err) return cb(error(err));
            plans = plans.data.sort(function(a, b) {
                if(a.amount > b.amount) {
                    return 1;
                } else if(a.amount < b.amount) {
                    return -1;
                } else {
                    return 0;
                }
            });

            if(user.stripe && user.stripe.customer_id && user.stripe.subscription_id) {
                stripe.customers.retrieveSubscription(user.stripe.customer_id, user.stripe.subscription_id, function(err, subscription) {
                    if(err) return cb(error(err));
                    if(!subscription || !subscription.plan || !subscription.plan.id) {
                        return cb(showPayment(user, null, plans, error));
                    }
                    return cb(showPayment(user, subscription.plan, plans, error));
                });
                
            } else {
                return cb(showPayment(user, null, plans, error));
            }
        });
    }


    function showPayment(user, user_plan, plans, error) {

        if(!user.stripe) {
            user.stripe = {};
        }

        planHtml = '<option value="">[please select]</option>';
        var i, plan, selected;
        for(i=0; i < plans.length; i++) {
            plan = plans[i];
            if((plan.currency != 'usd') || (plan.interval != 'month') || (plan.interval_count != 1) || plan.trial_period_days) {
                continue;
            }
            selected = (user_plan && (plan.id == user_plan.id)) ? ' selected' : '';
            planHtml += '<option value="'+plan.id+'"'+selected+'>$'+(plan.amount / 100)+' - ' + plan.name + '</option>';
        }

        var props = {
            '[key=status]': (user.stripe.subscription_id)
                ? { _text: "You have a recurring payment set up for $" + (user_plan.amount / 100) + " every month." }
                : { _text: "You have no recurring payments set up." },
            '[id=cancel]': user.stripe.subscription_id
            ? { _text: "cancel your subscription" }
            : { style: "display: none" },
            '[name=subscription_plan]': { _html: planHtml },
            '[key=cc_title]': (user.stripe.subscription_id)
            ? { _text: "change credit card" }
            : { _text: "credit card", class: "js-only" },
            '[key=cc_current]': user.stripe.last_two_digits
            ? { _text: "Your current card is the one ending in xx" + user.stripe.last_two_digits }
            : { _text: "Fill in your credit card info below.", class: "js-only" },
            '[id=publishableKey]': {
                value: settings.stripe_publishable_key
            },
            '[id=cancelForm]': !user.stripe.subscription_id
            ? { style: "display: none" } : {},
            '[key=subHeader]': !user.stripe.subscription_id
            ? { class: "js-only" } : {},
            '[key=subTable]': !user.stripe.subscription_id
            ? { class: "js-only" } : {},
            '[name=is_subscribed]': user.stripe.subscription_id
            ? { value: "yes" } : {}
        };

        return hyperstream(props);
        
    }
    
    function save (req, res, m, stripe) {
        users.get(m.session.data.id, function (err, user) {
            if (err) return m.error(500, err);
            if (!user) return m.error(404, 'no user data');

            // are we cancelling a subscription?
            if(m.params.cancel) {
                
                if(!user.stripe || !user.stripe.customer_id || !user.stripe.subscription_id) {
                    return m.error(500, "Trying to cancel non-existant subscription");
                }

                stripe.customers.cancelSubscription(
                    user.stripe.customer_id,
                    user.stripe.subscription_id,
                    function(err, confirmation) {
                        if(err) {
                            return m.error(500, err)
                        }
                        // TODO show confirmation number
                    });
                user.stripe = {};
                postSave(user, m, res);

                return;
            }

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

                    createOrUpdateSubscription(user, m, stripe, function(err, subscription) {
                        if(err) {return m.error(500, err)}
                        user.stripe.last_two_digits = m.params.lastTwoDigits;
                        user.stripe.subscription_id = subscription.id;
                        postSave(user, m, res);
                    });

                });
                
            } else { // this is an existing subscription being changed
                createOrUpdateSubscription(user, m, stripe, function(err, subscription) {
                    if(err) {return m.error(500, err)}
                    if(m.params.lastTwoDigits) {
                        user.stripe.last_two_digits = m.params.lastTwoDigits;
                    }
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
            res.setHeader('location', 'payment');
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

    function createOrUpdateSubscription(user, m, stripe, callback) {
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

};
