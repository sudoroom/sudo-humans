var userFromX = require('../lib/user_from_x.js');
var util = require('util');


module.exports = function (index, users, auth, blob, settings) {


    return function (req, res, m) {
        res.end("nope");

/*
        var customer_id = "";

        userFromX(index, 'ccl.stripe_customer_id', customer_id, function(err, user) {
            if(err) res.close(err);

            res.write("user: " + util.inspect(user));

            res.end();
        });


    };
*/
}
