var dump = require('level-dump')
var util = require('util')

module.exports = function (db, settings) {
    return function (req, res, match) {
        res.setHeader('Content-Type', 'text/plain')

        if (settings.export_secret && req.headers.cookie == "secret=" + settings.export_secret) {
            console.log("Dumping database...")
            res.write("BEGIN\n")
            dump(db, function write(data) {
                kbuf = new Buffer(data.key)
                vbuf = new Buffer(data.value)
                res.write(kbuf.toString('base64'))
                res.write(vbuf.toString('base64'))
            }, function end(err) {
                if (err) {
                    console.log(err)
                } else {
                    console.log("No error!")
                }
                res.write("END\n")
                res.end()
            })
        } else {
            res.write("Nothing to see here.")
        }

        res.end()
    }
}
