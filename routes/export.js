module.exports = function (db, settings) {
    return function (req, res, match) {
        console.log(req.headers);
    }
}
