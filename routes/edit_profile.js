var hyperstream = require('hyperstream');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');
var post = require('../lib/post.js');

module.exports = function (auth, ixf) {
    return function (req, res, m) {
        if (!m.session) {
            m.error('You must be signed in to use this page.');
        }
        else if (req.method === 'POST') {
            post(save)(req, res, m);
        }
        else layout(auth)('edit_profile.html', show)(req, res, m)
    };
    
    function show (req, res, m) {
        return hyperstream({
            '#edit-profile': {
                action: '/~' + m.session.data.name + '/edit'
            }
        });
    }
    
    function save (req, res, m) {
        
    }
};
