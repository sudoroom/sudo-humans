var dump = require('level-dump')

module.exports = function (db, settings) {
    return function (req, res, match) {
        res.setHeader('Content-Type', 'text/plain')

        if (settings.export_secret && req.headers.cookie == "secret=" + settings.export_secret) {
            console.log("Dumping database...")
            dump(db, function write(data) {
                res.write(JSON.stringify(data))
            }, function end(err) {
                console.log(err)
                res.end()
            })
        } else {
            res.write("Nothing to see here.")
        }

        res.end()
    }
}
