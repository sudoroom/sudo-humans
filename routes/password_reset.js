var post = require('../lib/post.js');
var userFromX = require('../lib/user_from_x.js');
var xkcdPassword = require('xkcd-password');
var mailer = require('nodemailer').createTransport();
var settings = require('../settings.js');



module.exports = function (users, index) {


    function updateLogin(user, password, cb) {
        users.removeLogin(user.id, 'basic', function (err) {
            if (err) return cb(err);
            users.addLogin(user.id, 'basic', {
                username: user.name,
                password: password
            }, cb);
        });
    }

    return post(function (req, res, m) {

        if(!m.params.email_or_username) {
            res.writeHead(303, { location: '/account/password-reset' });
            res.end();
            return;
        }


        var key;
        if(m.params.email_or_username.match('@')) {
            key = 'email';
        } else {
            key = 'name';
        }

        user = userFromX(index, key, m.params.email_or_username, function(err, user) {
            if(err) return m.error(500, err);

            if(!user || !user.email) {
                res.writeHead(303, { location: '/account/password-reset-success' });
                res.end();
                return;
            }

            var pwGen = new xkcdPassword();

            pwGen.generate(function(err, passwords) {
                if(err) return m.error(500, err);
                
                password = passwords.join('.');
              
                updateLogin(user, password, function(err) {
                    if(err) return m.error(500, err);

                    mailer.sendMail({
                        from: settings.mail_from_address,
                        to: user.email,
                        subject: "[sudo-humans] Password reset!",
                        text: "Your password has been reset.\n\nYour new password is: " + password + "\n\nYou can log in at: " + settings.base_url + "/account/sign-in\n\nhack hack hack"
                }, function(err, info) {
                    if(err) return m.error(500, err);

                    res.writeHead(303, { location: '/account/password-reset-success' });
                    res.end();
                    return;

                });


                    
                    
                });



            });


        });


    });
};
