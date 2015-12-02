
var through = require('through2');

/*
  To run this script: 

     ./bin/cmd.js --migrate migrations/grant_all_privs.js collective username

  E.g:

     ./bin/cmd.js --migrate migrations/grant_all_privs.js sudoroom juul
*/


function grant(collectiveName, userName, users, settings, callback) {
    var r = users.list();
    r.once('error', function (err) { cb(err) });
    r.pipe(through.obj(write, end));

    var collective = settings.collectives[collectiveName];
    var found = false;
    var addedPrivs = [];

    function write(row, enc, cb) {
        if(!row) return;
        var user = row.value

        if(user.name !== userName) return cb();

        process.stdout.write("Granting all privileges to " + user.name + ": ");

        if(!user.collectives[collectiveName]) {
            user.collectives[collectiveName] = { privs: [] };
        }

        if(!user.collectives[collectiveName].privs) {
            user.collectives[collectiveName].privs = [];
        }

        var i, priv;
        for(i=0; i < collective.privs.length; i++) {
            priv = collective.privs[i];
            if(user.collectives[collectiveName].privs.indexOf(priv) < 0) {
                user.collectives[collectiveName].privs.push(priv);
                addedPrivs.push(priv);
            }
            found = true;
        }


        users.put(user.id, user, function (err) {
            if(err) {
                console.log(''); // add newline
                callback(err);
                return
            }
            found = true;
            console.log("Done.");
            cb();
        });

    }
    function end () { callback(null, found, addedPrivs) }
}


module.exports = function(users, ixf, counts, blob, argv, settings, callback) {
    if(argv._.length != 2) {
       console.error("Usage: ./bin/cmd.js --migrate migrations/grant_all_privs.js collective_shortname username");
       return callback("Try reading the comment at the top of the source code of the migration file");
    }

    var collectiveName = argv._[0];
    var collective = settings.collectives[collectiveName];
    if(!collective) {
        return callback("Collective not found in settings.js");
    }
    var userName = argv._[1];

    grant(collectiveName, userName, users, settings, function(err, found, addedPrivs) {
        if(err) {
            callback("Error: " + err);
            return;
        }
        
        if(found) {
            console.log("Granted the following "+addedPrivs.length+" privileges to "+userName+": " + addedPrivs.join(', '));
        } else {
            console.log("User not found :/");
        }
    });


};
