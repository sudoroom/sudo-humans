var post = require('../lib/post.js');
var crypto = require('crypto');
var sublevel = require('subleveldown');
var bytewise = require('bytewise');
var through = require('through2');
var retricon = require('retricon');
var layout = require('../lib/layout.js');
var hyperstream = require('hyperstream');
var duplexer = require('duplexer2');

module.exports = function (users, auth, blob, argv, settings) {


    return function (req, res, m) {
        users.list().pipe(through.obj(
            function (row) { goOn(req, res, m, false) },
            function () { goOn(req, res, m, true) }
        ));
    };

    function goOn(req, res, m, firstUser) {

        if(req.method === 'POST') {
            post(save)(req, res, m, firstUser);
        } else {
            layout(auth, settings)('create_account.html', show)(req, res, m, firstUser)
        }
    };


    function show (req, res, m, firstUser) {
        var input = through(), output = through();

        input.pipe(showPage(firstUser)).pipe(output);

        return duplexer(input, output);
    }

    function showPage(firstUser) {
        
        var chtml = '';
        if(firstUser) {
            chtml = '<p style="color:red">You are the first user in the system. You will receive all privileges for all collectives!</p>';
        } else {
            var shortname, col;
            for(shortname in settings.collectives) {
                col = settings.collectives[shortname];
                chtml += '<label for="'+shortname+'">'+col.name+'</label><input type="checkbox" id="'+shortname+'" name="collective['+shortname+']" /><br/>';
            }
        }

        var props = {
            '[key=collectives]': {_html: chtml}
        }
        return hyperstream(props);
    }

    
    function save(req, res, m, firstUser) {
        var id = crypto.randomBytes(16).toString('hex');
        var img = retricon(id, { pixelSize: 15, tiles: 5 });
        var w = img.pngStream().pipe(blob.createWriteStream());
        w.on('error', function (err) { m.error(500, err) });
        w.once('finish', function () { create(res, m, firstUser, id, w.key) });
    };
    
    function create (res, m, firstUser, id, avatar) {
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

        // add the user to the selected collectives
        var key, mtch, colName;
        for(key in m.params) {
            mtch = key.match(/collective\[(.*)\]/);
            if(!mtch || mtch.length != 2) continue;
            if(m.params[key] == 'on') {
                colName = mtch[1];
                opts.value.collectives[colName] = {privs:[]};
            }
        }

        console.log(opts.value.collectives);
        
        
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
