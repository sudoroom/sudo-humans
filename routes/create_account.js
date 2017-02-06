var post = require('../lib/post.js');
var crypto = require('crypto');
var sublevel = require('subleveldown');
var through = require('through2');
var retricon = require('retricon-without-canvas');
var layout = require('../lib/layout.js');
var hyperstream = require('hyperstream');
var duplexer = require('duplexer2');

module.exports = function (users, auth, blob, settings) {

    // if no users exist yet, set firstUser = true
    // if users already exist, set firstuser = false
    //
    // this fun idiom uses the stream API like an if/else block
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
            chtml = '<ul>\n';
            for(shortname in settings.collectives) {
                col = settings.collectives[shortname];
                chtml += '  <li>';
                chtml += '<input type="checkbox" id="'+shortname+'" name="collective['+shortname+']" />';
                chtml += '&nbsp;<label for="'+shortname+'">'+col.name+'</label>';
                chtml += '</li>\n';
            }
            chtml += '</ul>';
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
        // Top 25 most common passwords according to 
        // http://www.telegraph.co.uk/technology/2017/01/16/worlds-common-passwords-revealed-using/
        var common_passwords = ['123456', '123456789', 'qwerty', '12345678',
            '111111', '1234567890', '1234567', 'password', '123123',
            '987654321', 'qwertyuiop', 'mynoob', '123321', '666666',
            '18atcskd2w', '7777777', '1q2w3e4r', '654321', '555555',
            '3rjs1la7qe', 'google', '1q2w3e4r5t', '123qwe', 'zxcvbnm',
            '1q2w3e'];

        if (!m.params.name || !m.params.name.match(/^[a-z0-9]{3,16}$/)) {
            return m.error(400,"Error: invalid username");
        }

        if (!m.params.password) {
            return m.error(400, "Error: a password is required");
        } else if (common_passwords.indexOf(m.params.password) >= 0) {
            return m.error(400, "Error: you chose a very common, and therefore insecure, password. Please go back and pick a better password.");
        }

        if (!m.params.email) {
            return m.error(400, "Error: an email address is required");
        } else if (!m.params.email.match(/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i)) {
            return m.error(400, "Error: your email address is very likely syntactically invalid. Please go back and fix it. If your real, valid, working email address failed this test, please report the issue using the link at the bottom of this page.");
        }

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

        users.create(id, opts, function (err) {
            if (err) return m.error(400, err);
            if(settings.debug) {
                console.log('[debug] created user', m.params.name, 'with email', m.params.email, 'and password', m.params.password);
            }
            auth.login(res, { id: id, name: m.params.name }, onlogin);
        });
        function onlogin (err, session) {
            if (err) return m.error(400, err);
            res.writeHead(303, { location: settings.base_url + '/~' + m.params.name + '/welcome' });
            res.end();
        }
    }
};
