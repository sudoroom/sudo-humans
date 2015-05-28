var hyperstream = require('hyperstream');
var hyperquest = require('hyperquest');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');
var post = require('../lib/post.js');
var xtend = require('xtend');
var once = require('once');

module.exports = function (users, auth, blob) {
    return function (req, res, m) {
        if (!m.session) {
            m.error(401, 'You must be signed in to use this page.');
        }
        else if (req.method === 'POST') {
            post(save)(req, res, m);
        }
        else layout(auth)('members.html', show)(req, res, m)
    };
    
    function show (req, res, m) {
        var input = through(), output = through();
        users.get(m.session.data.id, function (err, user) {
            if (err) return m.error(err);
            if(!user.member) {
                return m.error("Only members can access this page");
            }

            getUsers(function(err, userList) {

                input.pipe(showUsers(userList, m.error)).pipe(output);

            });
        });
        return duplexer(input, output);
    }

    function getUsers(cb) {
        var userList = [];
        users.list('user.name')
            .pipe(through.obj(function (row, enc, next) {
                userList += "<li>" 
                    + row.value.name 
                    + ((row.value.member) ? ' [member]' : ' [comrade]')
                    +  "</li>";
                next();
            }, function() {cb(null, userList)}));
    }
    
    function showUsers(userList, error) {
 

        var props = {
            '[key=userList]': { _html: userList }
        };
        
        return hyperstream(props);
    }
}
