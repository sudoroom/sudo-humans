var hyperstream = require('hyperstream');
var duplexer = require('duplexer2');
var through = require('through2');
var layout = require('../lib/layout.js');
var post = require('../lib/post.js');

module.exports = function (auth, ixf) {
    return function (req, res, m) {
        if (req.method === 'POST') post(save)(req, res, m)
        else layout(auth)('edit_profile.html', show)(req, res, m)
    };
    
    function show (req, res, m) {
        return through();
    }
    
    function save (req, res, m) {
    }
};
