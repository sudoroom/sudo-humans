var post = require('../lib/post.js');
var userFromX = require('../lib/user_from_x.js');
var xkcdPassword = require('xkcd-password');

module.exports = function (users, index, settings) {

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
            res.writeHead(303, { location: settings.base_url + '/account/password-reset' });
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
                res.writeHead(303, { location: settings.base_url + '/account/password-reset-success' });
                res.end();
                return;
            }

            var pwGen = new xkcdPassword();

            pwGen.generate(function(err, passwords) {
                if(err) return m.error(500, err);
                
                password = passwords.join('.');
              
                updateLogin(user, password, function(err) {
                    if(err) return m.error(500, err);

                    if(settings.debug) {
                        console.log('[debug] password for user', user.name, 'with email address', user.email, 'reset to:', password);
                    }

                    var mailer; 

                    if(settings.mailer.type == 'direct') {
                        mailer = require('nodemailer').createTransport();
                    } else if(settings.mailer.type == 'smtp') {
                        var smtpTransport = require('nodemailer-smtp-transport');
                        mailer = require('nodemailer').createTransport(smtpTransport({
                            host: settings.mailer.host || "localhost",
                            port: settings.mailer.port || 25,
                            ignoreTLS: !settings.mailer.tls
                        }));
                    } else { // console output only
                        mailer = {
                            sendMail: function(data, cb) {
                                console.log("Not actually sending email:");
                                console.log("  From: " + data.from);
                                console.log("  To: " + data.to);
                                console.log("  Subject: " + data.subject);
                                console.log("  Content: \n" + (data.html || data.text));
                                cb(null, null);
                            }
                        }
                    }

                    mailer.sendMail({
                        from: settings.mailer.from_address,
                        to: user.email,
                        subject: "[sudo-humans] Password reset!",
                        text: "Your password has been reset.\n\nYour new password is: " + password + "\n\nYour pseudonym is still: " + user.name + "\n\nYou can log in at: " + settings.base_url + "/account/sign-in\n\nhack hack hack"
                    }, function(err, info) {
                        if(err) return m.error(500, err);
                        
                        res.writeHead(303, { location: settings.base_url + '/account/password-reset-success' });
                        res.end();
                        return;
                        
                    });
                });
            });
        });
    });
};
