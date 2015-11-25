var payment = require('./payment');

var membership = module.exports = {

    // check if the user has currently active credit for a collective
    // returns a Date object of the credit expiration it yes
    // returns null if no
    userHasCredit: function(user, collective) {
        var credit = user.collectives[collective].credit;
        if(credit && credit.begin && credit.end) {
            var begin = new Date(user.collectives[collective].credit.begin);
            if(!begin) return null;
            var end = new Date(user.collectives[collective].credit.end);
            if(!end) return null;
            if(end < new Date) return null;
            return {
                begin: begin,
                end: end,
                active: (begin <= new Date) // is the credit currently active?
            };
        }
        return null;
    },

    // takes a charge object as input 
    // and expects the charge object to include charge.balance_transaction
    calcStripeAmount: function (charge) {
        if(!charge.paid) return 0;
        if(charge.refunded) return 0;
        
        // TODO charge.amount_refunded does not include fees
        // we should instead iterate through charge.refunds 
        // and retrieve the balance_transaction for each
        // but that's a bunch of extra api calls
        
        return (charge.balance_transaction.net - charge.amount_refunded) / 100;
    },

    formatLevel: function (level, capitalize) {
        if(capitalize) {
            level = level.charAt(0).toUpperCase() + level.slice(1);
        }
        return level.replace(/_/g, ' ');
    },

    // get the highest level of membership granted by the paid amount
    getMembershipLevel: function (collective, paidAmount, settings) {

        var memberships = settings.collectives[collective].memberships;
        
        var highest = {amount: 0};
        var level, levelAmount;
        for(level in memberships) {
            levelAmount = memberships[level];
            if(paidAmount >= levelAmount) {
                if(paidAmount > highest.amount ) {
                    highest = {
                        amount: levelAmount,
                        level: level
                    }
                }
            }
        }
        if(highest.amount > 0) {
            return highest.level;
        }
        return null;
    },

    collectiveNames: function(settings) {
        var names = [];
        var collective;
        for(collective in settings.collectives) {
            names.push(settings.collectives[collective].name);
        }
        return names;
    },

    collectiveNamesSentence: function(settings) {
        var names = membership.collectiveNames(settings);
        var sentence = '';
        var i;
        for(i=0; i < names.length; i++) {
            if(i == 0) {
                sentence += names[i];
            } else if(i == names.length - 1) {
                sentence += ' and ' + names[i];
            } else {
                sentence += ', ' + names[i];
            }
        }
        return sentence;
    },

    // get membership status for a user in a collective
    status: function(user, collective) {
        if(!user.collectives || !user.collectives[collective]) {
            return null;
        }
        collective = user.collectives[collective];
        if(collective.privs.indexOf('admin') >= 0) {
            return "admin";
        }

        if(collective.privs.indexOf('member') >= 0) {
            return "member";
        }

        return "comrade";
    },

    // check if user has specified privilege
    hasPriv: function(user, collective, priv) {
        if(!user.collectives || !user.collectives[collective]) {
            return false;
        }
        collective = user.collectives[collective];
        if(collective.privs.indexOf(priv) >= 0) {
            return true
        }
        return false;
    },


    // is the user a member of the collective
    isMemberOf: function(user, collective) {
        if(!user.collectives || !user.collectives[collective]) {
            return false;
        }
        if(user.collectives[collective].privs.indexOf('member') >= 0) {
            return true;
        }

        return false;;
    },

    // opts.editable makes an editable table instead (default: false)
    // opts.payment shows payment info
    table: function(user, settings, opts) {
        opts = opts || {};

        user.collectives = user.collectives || {};

        var count = 0;
        var collective, cname, cstatus;
        var chtml = "<table><tr><th>collective</th><th>status</th>";
        
        if(opts.payments) {
            chtml += "<th>payment status</th>";
            chtml += "<th>last payment</th>";
        }
        if(opts.editable) {
            chtml += "<th>edit</th>";
        }
        
        chtml += "</tr>";
        
        var curPayment, txt;
        for(collective in user.collectives) {
            cname = (settings.collectives[collective]) ? settings.collectives[collective].name : collective;
            cstatus = membership.status(user, collective);
            if(!cstatus) {
                continue;
            }
            count++;

            chtml += "<tr><td>"+cname+"</td>";
            chtml += "<td>"+cstatus+"</td>";
            
            if(opts.payments) {
                curPayment = opts.payments[collective];
                
                if(curPayment && !curPayment.last_fail && curPayment.last_success) {
                    txt = "Paying!";
                } else {
                    if(!curPayment || (!curPayment.last_success && !curPayment.last_fail)) {
                        txt = "Not paying";
                    } else {
                        txt = "Not paying. Attempted but failed to charge " + payment.formatCharge(curPayment.last_fail);
                    }
                }
                chtml += '<td>'+txt+'</td>';
                
                if(!curPayment || !curPayment.last_success) {
                    txt = "No payments within last 12 months";
                } else {
                    txt =  payment.formatCharge(curPayment.last_success);
                }
                chtml += '<td>'+txt+'</td>';
            }
            
            if(opts.editable) {
                chtml += (settings.collectives[collective].stripe_api_key && settings.collectives[collective].stripe_publishable_key)
                    ? ('<td><a class="button" href="' + settings.base_url + '/~'+user.name+'/edit/'+collective+'">edit</a></td>')
                    : ('<td>n/a</td>');
            }
            
            chtml += "</tr>";
        }
        chtml += "</table>";

        if(count <= 0) {
            return "<p>Not associated with any collectives.</p>";
        } else {
            return chtml;
        }

    }
}
