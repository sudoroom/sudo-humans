var hyperstream = require('hyperstream');
var hyperquest = require('hyperquest');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');
var post = require('../lib/post.js');
var xtend = require('xtend');
var once = require('once');
var async = require('async');
var payment = require('../lib/payment.js');
var membership = require('../lib/membership.js');
var userFromX = require('../lib/user_from_x.js');
var Stripe = require('stripe');
var streamEach = require('../lib/stream_each.js');

function monthsAgo(months) {
    var d = new Date;
    d.setMonth(d.getMonth() - months);
    return Math.floor(d.valueOf() / 1000);
}

function getStripeCharges(collective, opts, settings, cb) {
    if(typeof opts == 'function') {
        cb = opts;
        opts = {};
    }
    opts = opts || {};

    var stripe = Stripe(settings.collectives[collective].stripe_api_key);

    var qOpts = {
        created: {
            gte: monthsAgo(1)
        },
        limit: 100, // TODO this is the highest stripe supports :(
        expand: ['data.balance_transaction']
    };
    if(opts.prev) {
        qOpts.starting_after = opts.prev;
    }
    stripe.charges.list(qOpts, function(err, obj) {
        if(err) return cb(err);
        var charges = obj.data;
        if(opts.charges) {
            charges = opts.charges.concat(charges);
        }
        // stripe only lets us fetch up to 100 charges at a time
        // so keep getting more until we're done
        if(obj.has_more) {
            return getStripeCharges(collective, {
                prev: obj.data[obj.data.length - 1].id,
                charges: charges
            }, settings, cb);
        }
        cb(null, charges);
    })
}

module.exports = function (index, users, auth, blob, settings) {
    return function (req, res, m) {
        if (!m.session) return m.error(401, 'You must be signed in to use this page.');

        var collective = m.params.collective;

        if(!settings.collectives || !settings.collectives[collective]) {
            return m.error(401, "No collective by that name exists.");
        }

/*
        if(settings.collectives[collective].privs.indexOf('admin') <= 0) {
            return m.error(401, "This collective does not allow admins. Take you hierarchical power-tripping mindset elsewhere Ⓐ.");
        }
*/

        users.get(m.session.data.id, function (err, user) {
            if(err) return m.error(500, err);
            if(!user) return m.error(401, "You are not logged in");

            if(!membership.hasPriv(user, collective, 'admin')) {
                return m.error(401, "Only admins can access this page.");
            }
            
            if (req.method === 'POST') {
                return post(save)(req, res, m);
            }

            getStripeCharges(collective, function(err, charges) {
                if(err) return cb("Failed to get stripe charges: " + err)

                getCounts(users, collective, charges, function(err, counts) {
                    if(err) return m.error(500, err);
                    
                    userTable(index, collective, charges, function(err, table) {

                        layout(auth, settings)('collective_admin.html', show)(req, res, m, users, user, collective, counts, table);

                    });
                    
                });

            }, settings);
        });
    };

    function userTable(index, collective, charges, cb) {
        var html = "<table><tr><th>user</th><th>email</th><th>status</th><th>payment status</th><th>last payment</th><th>edit</th>";

        var payingMembers = {};
        async.eachSeries(charges, function(charge, cb) {
            if(!charge.customer) return cb();

            userFromX(index, collective+'.stripe_customer_id', charge.customer, function(err, user) {
                if(err) {
                    console.log("ERRAW:", err);
                    return cb();
                }
                if(user) {
                    if(payingMembers[user.id]) {
                        payingMembers[user.id].charges.push(charge);
                    } else {
                        payingMembers[user.id] = {
                            user: user,
                            charges: [charge]
                        };
                    }
                }
                cb();
            });

        }, function(err) {
            if(err) return callback(err);
            var user;
            var r = index.createReadStream('user.'+collective);
            r.pipe(through.obj(function(row, enc, next) {
                user = row.value;
                if(!user.collectives[collective)) return next();
                html += "<tr>";
                html += "<td>"+user.name+"</td>";
                html += "<td>"+user.email+"</td>";
                html += "<td>"+(membership.isMemberOf(user, collective) ? "member" : "comrade")+"</td>";
                
                var paying = payingMembers[user.id];
                var payment_status = "Not paying";
                var last_payment = "More than a month ago";
                var paid;
                var failed;
                if(paying) {
                    var i, charge, amount, level;
                    for(i=0; i < charges.length; i++) {
                        charge = charges[i];
                        if(charge.refunded) continue;
                        if(charge.paid) {
                            amount = charge.amount - charge.amount_refunded;
                            level = membership.getMembershipLevel(collective, amount, settings);
                            if(level) {
                                payment_status = "Paying for "+membership.formatLevel(level)+" membership";
                                last_payment = payment.format(charge);
                                paid = true;
                                break;
                            }

                        }
                        failed = charge;
                    }
                    if(!paid && failed) {
                        last_payment = "Failed: " + charge.failure_message;
                    }
                }
                html += "<td>"+payment_status+"</td>";
                html += "<td>"+last_payment+"</td>";
                html += '<td><a href="../u/'+user.name+'">edit</a></td>';
                
                next();
            }, function() {
                html += "</table>\n";
                cb(null, html);
            }));
        });


    }
    
    function getCounts(users, collective, charges, cb) {

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

        // TODO use index to speed this up
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
                
            var level, levelAmount, i, chargeAmount, highestLevel;
            for(i=0; i < charges.length; i++) {
                chargeAmount = membership.calcStripeAmount(charges[i]);
                if(!chargeAmount) continue;
                counts.income += chargeAmount;                
                highestLevel = membership.getMembershipLevel(collective, chargeAmount, settings);

                if(highestLevel) {
                    counts.memberships[highestLevel]++;
                }
            }
            cb(null, counts);
        });
    }

    function show (req, res, m, users, user, collective, counts, table) {
        var input = through(), output = through();

        input.pipe(page(users, user, collective, counts, table)).pipe(output)
        return duplexer(input, output);
    }


    function page(users, user, collective, counts, table) {

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
            payingHTML += "<li>Total paying at the <span class='i'>"+membership.formatLevel(level, true)+"</span> ($"+amount+") level: " + count + "</li>\n";
            payingCount += count;
        }
        payingHTML += "<li>Total paying: "+payingCount+"</li>";

        var paymentUrl = 'payment';
        var props = {
            '[key=collective]': { _text: collective.name},
            '[key=comrade-count]': { _text: counts.comrades},
            '[key=member-count]': { _text: counts.members},
            '[key=paying-counts]': { _html: payingHTML},
            '[key=stripe-income]': { _text: Math.round(counts.income * 100) / 100},
            '[key=user-table]': { _html: table || ''},
        };

        return hyperstream(props);

    }
        

};
