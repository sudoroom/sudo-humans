var through = require('through2');

module.exports = function (index, users) {
    return function (req, res, m) {
        if(m.session && m.session.data && m.session.data.id) {

            users.get(m.session.data.id, function (err, user) {
                if (err) return m.error(err);
                if(user.name != 'juul') {
                    res.end("access denied");
                    return;
                }
                dump(res, user);
            });

        } else {
            res.end("access denied");
            return;
        }
    };

    function dump(res, user) {
        
        index.createReadStream('user.email')
            .pipe(through.obj(function (row, enc, next) {
                this.push(JSON.stringify(row.value, null, 2) + "\n\n");
                next();
            }))
            .pipe(res);
    }
};
