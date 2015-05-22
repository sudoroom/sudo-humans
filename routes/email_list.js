var through = require('through2');

module.exports = function (type, index, users) {
    return function (req, res, m) {
        if(m.session && m.session.data && m.session.data.id) {

            users.get(m.session.data.id, function (err, user) {
                if (err) return m.error(err);
                listUsers(res, user);
            });

        } else {
            listUsers(res);
        }
    };

    function listUsers(res, user) {
        
        index.createReadStream('user.email')
            .pipe(through.obj(function (row, enc, next) {
                if(row.value.visibility == 'members') {
                    if(!user || !user.member) {
                        next();
                        return;
                    }
                } else if(row.value.visibility == "accounts") {
                    if(!user) {
                        next();
                        return;
                    }
                }
                if (type === 'users'
                    || (type === 'members' && row.value.member)) {
                    this.push(row.value.email + '\n');
                }
                next();
            }))
            .pipe(res);
    }
};
