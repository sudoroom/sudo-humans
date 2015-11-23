var payment = require('./payment');

var membership = module.exports = {

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

    // is the user a member of the collective
    isMemberOf: function(user, collective) {
        if(!user.collectives || !user.collectives[collective]) {
            return false;
        }
        if(collective.privs.indexOf('member') >= 0) {
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
                chtml += '<td><a class="button" href="/~'+user.name+'/edit/'+collective+'">edit</a></td>';
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
