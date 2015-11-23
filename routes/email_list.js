var through = require('through2');

module.exports = function (type, index, users) {
    return function (req, res, m) {

        if(m.session && m.session.data && m.session.data.id) {

            users.get(m.session.data.id, function (err, user) {
                if (err) return m.error(err);

                listUsers(res, user, m.params.collective);
            });

        } else {
            listUsers(res);
        }
    };

    function listUsers(res, user, collective) {

        index.createReadStream('user.'+collective)
            .pipe(through.obj(function (row, enc, next) {
                if(row.value.visibility == 'members') {
                    if(!user || !user.collectives || !user.collectives[collective] || user.collectives[collective].privs.indexOf('member') < 0) {
                        next();
                        return;
                    }
                } else if(row.value.visibility == "accounts") {
                    if(!user) {
                        next();
                        return;
                    }
                }
                if ((type === 'users'
                    || type === 'members') && (row.value.collectives && row.value.collectives[collective] && row.value.collectives[collective].privs.indexOf('member') >= 0)) {
                    console.log(row.value);
                    this.push(row.value.email + '\n');
                }
                next();
            }))
            .pipe(res);
    }
};
