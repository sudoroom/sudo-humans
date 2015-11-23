var post = require('../lib/post.js');
var crypto = require('crypto');
var sublevel = require('subleveldown');
var bytewise = require('bytewise');
var through = require('through2');
var retricon = require('retricon');

var firstUser = false;

module.exports = function (users, auth, blob, argv, settings) {
    users.list().pipe(through.obj(
        function (row) { firstUser = false },
        function () { firstUser = true }
    ));
    
    return post(function (req, res, m) {
        var id = crypto.randomBytes(16).toString('hex');
        var img = retricon(id, { pixelSize: 15, tiles: 5 });
        var w = img.pngStream().pipe(blob.createWriteStream());
        w.on('error', function (err) { m.error(500, err) });
        w.once('finish', function () { create(res, m, id, w.key) });
    });
    
    function create (res, m, id, avatar) {
        var date = new Date().toISOString();
        var opts = {
            login: {
                basic: {
                    username: m.params.name,
                    password: m.params.password
                }
            },
            value: {
                type: 'user',
                id: id,
                name: m.params.name,
                email: m.params.email,
                fullName: m.params['full-name'],
                member: firstUser ? true : false, // TODO remove
                visibility: m.params.visibility,
                avatar: avatar,
                created: date,
                updated: date,
                collectives: {}
            }
        };
        // add first user to all collectives
        // and grant user all available privileges for each collective
        if(firstUser) {
            var collective;
            for(collective in settings.collectives) {
                opts.value.collectives[collective] = {
                    privs: settings.collectives[collective].privs
                }
            }
        }

        firstUser = false;
        
        users.create(id, opts, function (err) {
            if (err) return m.error(400, err);
            if(argv.debug) {
                console.log('[debug] created user', m.params.name, 'with email', m.params.email, 'and password', m.params.password);
            }
            auth.login(res, { id: id, name: m.params.name }, onlogin);
        });
        function onlogin (err, session) {
            if (err) return m.error(400, err);
            res.writeHead(303, { location: '../../~' + m.params.name + '/welcome' });
            res.end();
        }
    }
};
