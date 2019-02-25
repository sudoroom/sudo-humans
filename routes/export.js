module.exports = function (db, settings) {
    return function (req, res, match) {
        console.log(req.headers);
        res.setHeader('Content-Type', 'text/plain')
        res.write("Nothing to see here.")
        res.end()
    }
}
