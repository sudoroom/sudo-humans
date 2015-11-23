var hyperstream = require('hyperstream');
var hyperquest = require('hyperquest');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');
var post = require('../lib/post.js');
var xtend = require('xtend');
var once = require('once');
var membership = require('../lib/membership.js');

var settings = require('../settings.js');
var Stripe = require('stripe');

var streamEach = require('../lib/stream_each.js');

function monthsAgo(months) {
    var d = new Date;
    d.setMonth(d.getMonth() - months);
    return Math.floor(d.valueOf() / 1000);
}


function calcStripeAmount(charge) {
    if(!charge.paid) return 0;
    if(charge.refunded) return 0;

    // TODO charge.amount_refunded does not include fees
    // we should instead iterate through charge.refunds 
    // and retrieve the balance_transaction for each
    // but that's a bunch of extra api calls

    return (charge.balance_transaction.net - charge.amount_refunded) / 100;
}

module.exports = function (users, auth, blob, settings) {
    return function (req, res, m) {
        if (!m.session) return m.error(401, 'You must be signed in to use this page.');

        var collective = m.params.collective;

        if(!settings.collectives || !settings.collectives[collective]) {
            return m.error(401, "No collective by that name exists.");
        }

        if(settings.collectives[collective].privs.indexOf('admin') <= 0) {
            return m.error(401, "This collective does not allow admins. Take you hierarchical power-tripping mindset elsewhere Ⓐ.");
        }

        users.get(m.session.data.id, function (err, user) {
            if(err) return m.error(err);

            if(!membership.hasPriv(user, collective, 'admin')) {
                return m.error(401, "Only admins can access this page.");
            }
            
            if (req.method === 'POST') {
                return post(save)(req, res, m);
            }
            

            getCounts(users, collective, function(err, counts) {
                if(err) return m.error(500, err);

                layout(auth)('collective_admin.html', show)(req, res, m, users, user, collective, counts);                
                
            });
        });
    };
    
    function getCounts(users, collective, cb) {

        var stripe = Stripe(settings.collectives[collective].stripe_api_key);

        var userStream = users.list();
        var counts = {
            comrades: 0,
            members: 0,
            income: 0,
            memberships: {} // membership levels
        };
        var memberships = settings.collectives[collective].memberships;

        var level;
        for(level in memberships) {
            counts.memberships[level] = 0;
        }

        streamEach(userStream, function(row) {
            var user = row.value;
            if(user.collectives[collective]) {
                if(membership.isMemberOf(user, collective)) {
                    counts.members++;
                } else {
                    counts.comrades++;
                }
            }
        }, function(err) {
            if(err) return cb("Failed to get counts: " + err);

            stripe.charges.list({
                created: {
                    gte: monthsAgo(1)
                },
                limit: 100, // TODO this is the highest stripe supports :(
                expand: ['data.balance_transaction']
            }, function(err, charges) {
                if(err) return cb("Failed to get stripe charges: " + err)
                charges = charges.data;

                var level, levelAmount, i, chargeAmount, highest;
                for(i=0; i < charges.length; i++) {
                    chargeAmount = calcStripeAmount(charges[i]);
                    if(!chargeAmount) continue;
                    counts.income += chargeAmount;
                    highest = {amount: 0};
                    for(level in memberships) {
                        levelAmount = memberships[level];
                        if(chargeAmount >= levelAmount) {
                            if(chargeAmount > highest.amount ) {
                                highest = {
                                    amount: levelAmount,
                                    level: level
                                }
                            }
                        }
                    }
                    if(highest.level) {
                        counts.memberships[highest.level]++;
                    }
                }
                cb(null, counts);
            });
        });
    }

    function show (req, res, m, users, user, collective, counts) {
        var input = through(), output = through();

        input.pipe(page(users, user, collective, counts)).pipe(output)
        return duplexer(input, output);
    }


    function page(users, user, collective, counts) {

        if(!user.stripe) {
            user.stripe = {};
        }

        collective = settings.collectives[collective];

        var payingCount = 0;
        var payingHTML = '';
        var level, count, pLevel, amount;
        for(level in counts.memberships) {
            amount = collective.memberships[level];
            count = counts.memberships[level];
            pLevel = level.charAt(0).toUpperCase() + level.slice(1);
            pLevel = pLevel.replace(/_/g, ' ');
            payingHTML += "<li>Total paying at the <span class='i'>"+pLevel+"</span> ($"+amount+") level: " + count + "</li>\n";
            payingCount += count;
        }
        payingHTML += "<li>Total paying: "+payingCount+"</li>";

        var paymentUrl = 'payment';
        var props = {
            '[key=collective]': { _text: collective.name},
            '[key=comrade-count]': { _text: counts.comrades},
            '[key=member-count]': { _text: counts.members},
            '[key=paying-counts]': { _html: payingHTML},
            '[key=stripe-income]': { _text: Math.round(counts.income * 100) / 100}
        };

        return hyperstream(props);

    }
        

};
