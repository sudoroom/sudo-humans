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
var escape_html = require('escape-html');

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
            return m.error(404, "No collective by that name exists.");
        }

        users.get(m.session.data.id, function (err, user) {
            if(err) return m.error(500, err);
            if(!user) return m.error(401, "You are not logged in");

            if(!membership.hasPriv(user, collective, 'admin')) {
                return m.error(403, "Only admins can access this page.");
            }

            if (req.method === 'POST') {
                return post(save)(req, res, m);
            }

            getStripeCharges(collective, function handleStripeCharges(err, charges) {
                if (err) {
                    // Even if we can't get the list of charges from Stripe, we
                    // might as well show the *rest* of the admin page.
                    console.log('[warn] Failed to get stripe charges: ' + err);
                }

                getCounts(users, collective, charges, function(err, counts) {
                    if (err) return m.error(500, err);

                    renderUserTableHTML(index, collective, charges, function(err, table) {

                        layout(auth, settings)('collective_admin.html', show)(req, res, m, users, user, collective, counts, table);

                    });

                });

            }, settings);
        });
    };

    function renderUserTableHTML(index, collective, charges, cb) {
        var html = "\n<table>\n";
        html += "<tr>\n";
        html += "  <th>user</th>\n";
        html += "  <th>email</th>\n";
        html += "  <th>status</th>\n";
        html += "  <th>payment status</th>\n";
        html += "  <th>last payment</th>\n";
        html += "  <th>edit</th>\n";
        html += "</tr>\n";

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
                if(!user.collectives[collective]) return next();
                html += "<tr>\n";
                html += "  <td";
                if (!user.name.match(/^[a-z0-9]{3,16}$/)) {
                    // username would not pass validation if account were
                    // created today, so flag it as problematic
                    html += ' style="background: #ffbaba;"';
                    html += ' title="Username fails validation test"';
                }
                html += ">" + escape_html(user.name) + "</td>\n";
                html += "  <td";
                if (!user.email.match(/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i)) {
                    // email is probably syntactically invalid
                    html += ' style="background: #ffbaba;"';
                    html += ' title="Email fails syntax check"';
                }
                html += ">" + escape_html(user.email) + "</td>\n";
                html += "  <td>" +
                  (membership.isMemberOf(user, collective) ? "member" : "comrade") +
                  (membership.hasPriv(user, collective, 'admin') ?
                    "&nbsp;<sup><abbr title='This user is an admin'>A</abbr></sup>" : "") +
                  "</td>\n";
                
                var paying = payingMembers[user.id];
                var payment_status = "<em>none</em>";
                var last_payment = "N/A";
                var paid;
                var failed;
                if (paying) {
                    var i, charge, amount, level;
                    for (i=0; i < paying.charges.length; i++) {
                        charge = paying.charges[i];
                        if(charge.refunded) continue;
                        if(charge.paid) {
                            amount = charge.amount - charge.amount_refunded;
                            level = membership.getMembershipLevel(collective, amount, settings);
                            if(level) {
                                payment_status = membership.formatLevel(level);
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
                html += "  <td>" + payment_status + "</td>\n";
                html += "  <td>" + last_payment + "</td>\n";
                html += '  <td><a href="../u/' + encodeURIComponent(user.name);
                html += '">edit</a></td>\n';
                html += "</tr>\n";
                
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
            admins: 0,
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
                if(membership.hasPriv(user, collective, 'admin')) {
                    counts.admins++;
                }
                if(membership.isMemberOf(user, collective)) {
                    counts.members++;
                } else {
                    counts.comrades++;
                }
            }
        }, function(err) {
            if(err) return cb("Failed to get counts: " + err);

            if (typeof charges === 'undefined') {
                var charges = new Array();
            }
                
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
            '[key=admin-count]': { _text: counts.admins},
            '[key=comrade-count]': { _text: counts.comrades},
            '[key=member-count]': { _text: counts.members},
            '[key=paying-counts]': { _html: payingHTML},
            '[key=stripe-income]': { _text: Math.round(counts.income * 100) / 100},
            '[key=user-table]': { _html: table || ''},
        };

        return hyperstream(props);

    }
        

};
