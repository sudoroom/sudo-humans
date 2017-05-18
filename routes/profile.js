var fromName = require('../lib/user_from_name.js');
var marked = require('marked');
var render = require('../lib/render.js')();
var Promise = require('promise');

module.exports = function (ixf, blob, template_data) {
    return function (req, res, m) {
        fromName(ixf.index, m.params.name, function (err, user) {
            template_data.name = m.params.name;

            if (err) {
                return m.error(500, err);
            } else if (!user) {
                render('profile_404.pug', template_data)(req, res, m);
                return;
            } else if (typeof m.session === 'object' &&
                  typeof m.session.data === 'object' &&
                  typeof m.session.data.name === 'string') {
                template_data.current_user = { username: m.session.data.name };
                // a user is logged in. figure out if they have access.
                if (user.name === m.session.data.name) {
                    // show the user their own profile
                    // additional private data will be sent in this case
                    template_data.user = user;
                    markdown(user.about).then(
                        function (rendered_md_string) {
                            template_data.about = rendered_md_string;
                            render('profile.pug', template_data)(req, res, m);
                        }
                    );
                    return;
                } else if (user.visibility === 'members') {
                    // check whether session user is a member or admin of
                    // an overlapping set of collectives with requested user
                    var permission_check = new Promise(function doUserPermissionCheck(resolve, reject) {
                        fromName(ixf.index, m.session.data.name, function(err, current_user) {
                            if (err) {
                                reject(err);
                            }
                            for (var c in current_user.collectives) {
                                if (c in user.collectives) {
                                    if (current_user.collectives[c].privs.indexOf('admin') !== -1 ||
                                          current_user.collectives[c].privs.indexOf('member') !== -1) {
                                        resolve(true);
                                        return;
                                    }
                                }
                            }
                            resolve(false);
                        });
                    });

                    permission_check.then(
                        function handlePermissionCheckResult(check_result) {
                            if (check_result === true) {
                                markdown(user.about).then(
                                    function (rendered_md_string) {
                                        template_data.about = rendered_md_string;
                                        render('profile.pug', template_data)(req, res, m);
                                    }
                                );
                                return;
                            } else {
                                render('profile_403.pug', template_data)(req, res, m);
                                return;
                            }
                        },
                        function handlePermissionCheckFailure() {
                            return m.error(500, 'Unable to check permissions');
                        }
                    );

                } else if (user.visibility === 'accounts' ||
                      user.visibility === 'everyone') {
                    template_data.user = user;
                    markdown(user.about).then(
                        function (rendered_md_string) {
                            template_data.about = rendered_md_string;
                            render('profile.pug', template_data)(req, res, m);
                        }
                    );
                    return;
                } else {
                    return m.error(
                        500, 'unable to determine profile visibility: ' +
                        user.visibility);
                }
            } else if (user.visibility === 'everyone') {
                // no user logged in, so only show the profile if public
                template_data.user = user;
                markdown(user.about).then(
                    function (rendered_md_string) {
                        template_data.about = rendered_md_string;
                        render('profile.pug', template_data)(req, res, m);
                    }
                );
                return;
            } else {
                render('profile_403.pug', template_data)(req, res, m);
                return;
            }
        });
    };
    
    function markdown (key) {
        var rendered_markdown = new Promise(function (resolve, reject) {
            var s = '';
            if (key) {
                var r = blob.createReadStream(key);
                r.on('error', function(err) { reject(err); });
                r.on('data', function(buf) { s += buf.toString('utf8'); });
                r.on('end', function(buf) {
                    if (buf) { s += buf.toString('utf8'); }
                    resolve(marked(s, { sanitize: true }));
                });
            } else {
                resolve(s);
            }
        });

        return rendered_markdown;
    }
};
