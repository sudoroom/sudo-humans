// var dump = require('level-dump')
var util = require('util')

module.exports = function (datalevel, ixdb, sessions, settings) {
    return function (req, res, match) {
        res.setHeader('Content-Type', 'text/plain')
        console.log("export request received for " + match.params.database)

        if (settings.export_secret && req.headers.cookie == "secret=" + settings.export_secret) {
            switch (match.params.database) {
                case "datalevel":
                    db = datalevel;
                    break;
                case "ixdb":
                    db = ixdb;
                    break;
                case "sessions":
                    db = sessions;
                    break;
                default:
                    res.writeHead(404, { "Content-Type": "text/plain" });
                    res.end("Not Found");
                    return;
            }

            console.log("Dumping database...")
            response = ""
            // dump.allEntries(db, function write(data) {
            //     kbuf = new Buffer(data.key)
            //     vbuf = new Buffer(data.value)
            //     response += kbuf.toString('base64') + "\n"
            //     response += vbuf.toString('base64') + "\n"
            // }, function end(err) {
            //     if (err) {
            //         console.log(err)
            //     } else {
            //         console.log(response)
            //         console.log("No error!")
            //         res.end(response)
            //     }
            // })
        } else {
            res.end("Nothing to see here.")
        }
    }
}
