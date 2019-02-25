var dump = require('level-dump')

module.exports = function (db, settings) {
    return function (req, res, match) {
        res.setHeader('Content-Type', 'text/plain')

        if (settings.export_secret && req.headers.cookie == "secret=" + settings.export_secret) {
            console.log("Dumping database...")
            dump(db, function write(data) {
                console.log("Dump proceeding...")
                res.write(util.format("%o", data))
            }, function end(err) {
                if (err) {
                    console.log(err)
                } else {
                    console.log("No error!")
                }
                res.end()
            })
        } else {
            res.write("Nothing to see here.")
        }

        res.end()
    }
}
