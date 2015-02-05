var exts = [ 'asc', 'pub', 'png' ];

module.exports = function (users, blob) {
    return function (req, res, m) {
        var ext = m.params.ext;
        if (exts.indexOf(ext) < 0) return m.error(404, 'not found');
        
        users.get(m.session.data.id, function (err, user) {
            if (err) return m.error(500, err);
            
            var stream;
            if (ext === 'asc') {
                stream = read(user.gpg);
            }
            else if (ext === 'pub') {
                stream = read(user.ssh);
            }
            else if (ext === 'png') {
                stream = read(user.avatar);
            }
            
            if (!stream) return m.error(404, 'not found');
            stream.on('error', function (err) { m.error(500, err) });
            stream.pipe(res);
        });
    }
    
    function read (key) {
        if (key === undefined) return undefined;
        return blob.createReadStream(key);
    }
};
