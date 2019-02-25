module.exports = function (db, settings) {
    return function (req, res, match) {
        res.setHeader('Content-Type', 'text/plain')

        if (settings.export_secret && req.headers.cookie == "secret=" + settings.export_secret) {
            res.write("You may enter.")
        } else {
            res.write("Nothing to see here.")
        }

        res.end()
    }
}
