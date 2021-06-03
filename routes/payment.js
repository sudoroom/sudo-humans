var hyperstream = require('hyperstream');
var hyperquest = require('hyperquest');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');
var post = require('../lib/post.js');
var xtend = require('xtend');
var once = require('once');
const { promisify } = require('util');

var Stripe = require('stripe');

module.exports = function (users, auth, blob, settings) {

    return function (req, res, m) {
        if (!m.session) {
            return m.error(401, 'You must be signed in to use this page.');
        }

        var collective = m.params.collective;

        if(!settings.collectives || !settings.collectives[collective]) {
            return m.error(404, "No collective by that name exists.");
        }

        var stripe = Stripe(settings.collectives[collective].stripe_api_key);
        if (req.method === 'POST') {
            post(save)(req, res, m, collective, stripe);
        } else {
            layout(auth, settings)('payment.html', show)(req, res, m);
        }
    };

    function show (req, res, m) {
        var input = through(), output = through();
        users.get(m.session.data.id, function (err, user) {
            if (err) return m.error(err);

            var collective = m.params.collective;

            if (!user.collectives[collective]) {
                return m.error(404, "You are not a member of that collective.");
            }

            if(!user.collectives[collective].stripe) {
                user.collectives[collective].stripe = {};
            }

            var stripe = Stripe(settings.collectives[collective].stripe_api_key);
            var userStripe = user.collectives[collective].stripe;

            computeStream(user, m.error, collective, stripe, userStripe)
                .then((hypstr) => input.pipe(hypstr).pipe(output));
        });
        return duplexer(input, output);
    }

    function computeStream(user, onerror, collective, stripe, userStripe) {

        stripe.plans.list({limit: 50}, function(err, plans) {
            if (err) return onerror(err);
            plans = plans.data.sort(function(a, b) {
                if(a.amount > b.amount) {
                    return 1;
                } else if(a.amount < b.amount) {
                    return -1;
                } else {
                    return 0;
                }
            });

            const retrieveSubscription = promisify(stripe.customers.retrieveSubscription); 

            const planPromise = userStripe && userStripe.customer_id && userStripe.subscription_id
                ? retrieveSubscription(userStripe.customer_id, userStripe.subscription_id)
                    .then((subscription) =>
                        subscription && subscription.plan && subscription.plan.id
                            ? subscription.plan
                            : null
                    )
                    .catch(err => {
                        if (err && err.statusCode !== 404) {
                            onerror(err);
                        }
                    })
                : Promse.resolve(null);

            return planPromise.then(plan => showPayment(user, collective, userStripe, plan, plans, onerror));
        });
    }

    function getUserSubcription(stripe, user, collective, cb) {
        if(!user || !user.collectives || !user.collectives[collective] || !user.collectives[collective].stripe) {
            return cb(null, null);
        }
        var userStripe = user.collectives[collective].stripe;
        if(!userStripe.customer_id || !userStripe.subscription_id) {
            return cb(null, null);
        }

        stripe.customers.retrieveSubscription(userStripe.customer_id, userStripe.subscription_id, function(err, subscription) {
            if(err) {
                if(err.statusCode !== 404) return cb(err);
                return cb(null, null);
            }
            return cb(null, subscription);
        });
    }

    function showPayment(user, collective, userStripe, user_plan, plans, error) {

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
            '[key=headline]': settings.collectives[collective].name + ' membership',
            '[key=status]': (userStripe.subscription_id && user_plan)
                ? { _text: "You have a recurring payment set up for $" + (user_plan.amount / 100) + " every month." }
                : { _text: "You have no recurring payments set up." },
            '[id=cancel]': (userStripe.subscription_id && user_plan)
                ? { _text: "cancel your subscription" }
                : { style: "display: none" },
            '[name=subscription_plan]': { _html: planHtml },
            '[key=cc_title]': (userStripe.subscription_id && user_plan)
                ? { _text: "change credit card" }
                : { _text: "credit card", class: "js-only" },
            '[key=cc_current]': (userStripe.last_two_digits && user_plan)
            ? { _text: "Your current card is the one ending in xx" + userStripe.last_two_digits }
            : { _text: "Fill in your credit card info below.", class: "js-only" },
            '[id=publishableKey]': {
                value: settings.collectives[collective].stripe_publishable_key
            },
            '[id=cancelForm]': !userStripe.subscription_id
            ? { style: "display: none" } : {},
            '[key=subHeader]': !userStripe.subscription_id
            ? { class: "js-only" } : {},
            '[key=subTable]': !userStripe.subscription_id
            ? { class: "js-only" } : {},
            '[name=is_subscribed]': userStripe.subscription_id
            ? { value: "yes" } : {}
        };

        return hyperstream(props);
        
    }
    
    function save (req, res, m, collective, stripe) {
        users.get(m.session.data.id, function (err, user) {
            if (err) return m.error(500, err);
            if (!user) return m.error(404, "No user data");
            if (!m.params.collective) return m.error(404, "No collective specified");
            if (!user.collectives[collective]) m.error(404, "User "+user.name+" isn't even a comrade of this collective. The user should join as a comrade before trying to pay.");

            if(!user.collectives[collective].stripe) {
                user.collectives[collective].stripe = {};
            }
            var userStripe = user.collectives[collective].stripe;

            getUserSubcription(stripe, user, collective, function(err, sub) {

                // are we cancelling a subscription?
                if(m.params.cancel) {
                    
                    if(!userStripe || !userStripe.customer_id || !userStripe.subscription_id) {
                        return m.error(500, "Trying to cancel non-existant subscription");
                    }
                    
                    stripe.customers.cancelSubscription(
                        userStripe.customer_id,
                        userStripe.subscription_id,
                        function(err, confirmation) {
                            if(err) {
                                return m.error(500, err)
                            }
                            // TODO show confirmation number
                        });
                    userStripe.last_two_digits = undefined;
                    userStripe.customer_id = undefined;
                    userStripe.subscription_id = undefined;
                    postSave(user, collective, m, res);
                    
                    return;
                }
                
                // TODO input validation!
                
                if(!sub) {
                    
                    stripe.customers.create({
                        description: user.name + ' | ' + user.email,
                    }, function(err, customer) {
                        if(err) {
                            return m.error(500, err);
                        }
                        
                        userStripe.customer_id = customer.id;
                        
                        createOrUpdateSubscription(stripe, user, userStripe, null, m, function(err, subscription) {
                            if(err) {return m.error(500, err)}
                            console.log("created: ", subscription);
                            userStripe.last_two_digits = m.params.lastTwoDigits;
                            userStripe.subscription_id = subscription.id;
                            postSave(user, collective, m, res);
                        });
                        
                    });
                    
                } else { // this is an existing subscription being changed
                    createOrUpdateSubscription(stripe, user, userStripe, sub, m, function(err, subscription) {
                        if(err) {return m.error(500, err)}
                        if(m.params.lastTwoDigits) {
                            userStripe.last_two_digits = m.params.lastTwoDigits;
                        }
                        userStripe.subscription_id = subscription.id;
                        postSave(user, collective, m, res);
                    });
                }
            });
        });
    }


    function postSave(user, collective, m, res) {
        saveUser(user, function(err, user) {
            if(err) {return m.error(500, err)}
            res.statusCode = 302;
            res.setHeader('location', settings.base_url + '/~'+user.name+'/edit/'+collective);
            res.end('done');
        });
    }

    function saveUser(user, callback) {
        user.updated = new Date().toISOString();
        users.put(user.id, user, function (err) {
            if(err) return callback(err);
            callback(null, user);
        });
    }
    function createOrUpdateSubscription(stripe, user, userStripe, sub, m, callback) {

        if(sub) {
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
                userStripe.customer_id,
                sub.id,
                updatedFields,
                callback
            );
        } else {
            console.log("Creating with id:", userStripe.customer_id, "and opts:", m.params);
            stripe.customers.createSubscription(
                userStripe.customer_id, {
                plan: m.params.subscription_plan,
                source: m.params.stripeToken
            }, callback);
        }
    }    

};
