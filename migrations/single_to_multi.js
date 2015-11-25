/*
  Migrate database from single-collective to multi-collective operation.
  This script is necessary when upgrading from the old single-collective codebase.

  To run this script: 

     ./bin/cmd.js --migrate migrations/single_to_multi.js collective_shortname

   Where collective_shortname is the short name of the existing collective for
   which the old single-collective version of sudo-humans was being used, e.g:

     ./bin/cmd.js --migrate migrations/single_to_multi.js sudoroom

*/


function migrate(collective, index, users, settings, cb) {
    var r = index.createReadStream('user.name');
    r.once('error', function (err) { cb(err) });
    r.pipe(through.obj(write, end));
     
    function write(row, cb) {
        var user = user.row;
        users.put(user.id, doc, function (err) {
            if (err) return cb(err);

        });
    }
    function end () { cb() }
}

/* NOT DONE! DO NOT RUN!

module.exports = function(users, ixf, counts, blob, argv, settings, callback) {
    if(argv._.length != 1) {
       console.error("Name of existing collective missing!");
       console.error("Usage: ./bin/cmd.js --migrate migrations/single_to_multi.js collective_shortname");
       return callback("Try reading the comment at the top of the source code of the migration file");
    }

    var collective = argv._[0];
    migrate(collective, ixf.index, users, settings, function(err) {
        callback("Migration failed part-way through! This is bad but probably not terrible. The migration is designed to be runnable on a partially migrated database, so if you fix the problem you can simply run it again then everything should work. The error was: " + err);
        
    });


};
*/
