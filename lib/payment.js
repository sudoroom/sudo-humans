
var async = require('async');
var moment = require('moment');
var Stripe = require('stripe');

function monthsAgo(months) {
    var d = new Date;
    d.setMonth(d.getMonth() - months);
    return Math.floor(d.valueOf() / 1000);
}


var payment = module.exports = {

    format: function(charge) {
        return payment.formatCharge(payment.simplifyCharge(charge));
    },

    formatCharge: function(simplifiedCharge) {
        
        return '$' + (simplifiedCharge.amount / 100) + ' on ' + moment(simplifiedCharge.when).format('MMMM Do YYYY');
    },

    simplifyCharge: function(charge) {
        return {
            when: new Date(charge.created * 1000),
            amount: charge.amount - charge.amount_refunded
        };
    },

    getLatestPayments: function(user, settings, callback) {
        if(!user.collectives) {
            return callback(null, {});
        }
        var payments = {};
        async.each(Object.keys(user.collectives), function(collective, callback) {
            payment.getLatestPayment(user, collective, settings, function(err, success_charge, failed_charge) {
                if(err) return callback(); // skip collectives with no payments

                payments[collective] = {
                    last_success: success_charge,
                    last_fail: failed_charge
                };
                callback();
            });
            

        }, function(err) {
           if(err) return callback(err);
            callback(null, payments);
        });
    },

    // callback gets the following arguments:
    //   err: an error if one occurred
    //   successful_charge: if one of the last 12 charges was successful then
    //                      this will be an object representing the latest 
    //                      successful charge, with .when (a Date) and .amount set
    //   failed_charge: if the latest charge was a failed charge then this will
    //                  be an object with .when and .amount set for that charge

    getLatestPayment: function(user, collectiveName, settings, callback) {


        var collective = settings.collectives[collectiveName];

        if(!collective || !collective.stripe_api_key) {
            return callback("Invalid collective or collective is missing API key");
        }

        if(!user.collectives || !user.collectives[collectiveName] || !user.collectives[collectiveName].stripe || !user.collectives[collectiveName].stripe.customer_id) {
            return callback("User does not have a stripe customer ID for this collective");
        }

        var stripe = Stripe(collective.stripe_api_key);

        stripe.charges.list({
            created: {
                gte: monthsAgo(1)
            },
            customer: user.collectives[collectiveName].stripe.customer_id
        }, function(err, charges) {
            if(err) return callback(err);

            if(!charges.data || charges.data.length < 1) {
                return callback("User has never made a payment");
            }
            charges = charges.data;

            var failed;
            var succeeded;
            var charge, i;
            for(i=0; i < charges.length; i++) {
                charge = charges[i];

                // remember latest failed charge
                if(!failed && charge.status != "succeeded" && charge.status != "paid") {
                    failed = payment.simplifyCharge(charge);

                // The Stripe API docs say that status is 'succeeded' 
                // but it is actually 'paid'
                } else if(charge.status == "paid" || charge.status == "succeeded") {
                    if(charge.paid && !charge.refunded) {
                        succeeded = payment.simplifyCharge(charge);
                    }
                    break;
                }
            }

            callback(null, succeeded, failed);
        });
    }
};
