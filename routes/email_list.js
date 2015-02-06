var through = require('through2');

module.exports = function (type, index) {
    return function (req, res, m) {
        index.createReadStream('user.email')
            .pipe(through.obj(function (row, enc, next) {
                if (type === 'users'
                || (type === 'members' && row.value.member)) {
                    this.push(row.value.email + '\n');
                }
                next();
            }))
            .pipe(res);
        ;
    };
};
