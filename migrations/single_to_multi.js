
var through = require('through2');

/*
  Migrate database from single-collective to multi-collective operation.
  This script is necessary when upgrading from the old single-collective codebase.

  To run this script: 

     ./bin/cmd.js --migrate migrations/single_to_multi.js collective_shortname

   Where collective_shortname is the short name of the existing collective for
   which the old single-collective version of sudo-humans was being used, e.g:

     ./bin/cmd.js --migrate migrations/single_to_multi.js sudoroom

*/


function migrate(collectiveName, users, settings, callback) {
    var r = users.list();
    r.once('error', function (err) { cb(err) });
    r.pipe(through.obj(write, end));
    var collective = settings.collectives[collectiveName];

    var count = 0;
     
    function write(row, enc, cb) {
        if(!row) return;
        var user = row.value

        if(typeof user.collectives === 'object') {
            console.log("Skipping", user.name, "(user had already been migrated)");
            cb();
            return;
        }


        var privs = [];
        if(user.member && (collective.privs.indexOf('member') >= 0)) {
            privs.push('member');
        }

        user.collectives = {};
        user.collectives[collectiveName] = {
            privs: privs,
            stripe: user.stripe
        };

        delete user.stripe;
        delete user.member;
        process.stdout.write("Migrating " + user.name + ": ");

        users.put(user.id, user, function (err) {
            if(err) {
                console.log(''); // add newline
                callback(err);
                return
            }
            count++;
            console.log("Done.");
            cb();
        });

    }
    function end () { callback(null, count) }
}


module.exports = function(users, ixf, counts, blob, argv, settings, callback) {
    if(argv._.length != 1) {
       console.error("Name of existing collective missing!");
       console.error("Usage: ./bin/cmd.js --migrate migrations/single_to_multi.js collective_shortname");
       return callback("Try reading the comment at the top of the source code of the migration file");
    }

    var collectiveName = argv._[0];
    var collective = settings.collectives[collectiveName];
    if(!collective || !collective.name || !collective.privs) {
        console.error("You haven't defined your collectives with at least their names and privileges in your settings file.");
        return callback("Look at settings.js.example");
    }
    migrate(collectiveName, users, settings, function(err, count) {
        if(err) {
            callback("Migration failed part-way through! This is bad but probably not terrible. The migration is designed to be runnable on a partially migrated database, so if you fix the problem you can simply run it again then everything should work. The error was: " + err);
            return;
        }
        console.log("Migrated", count, "accounts.");
        console.log("Migration complete!");
    });


};
