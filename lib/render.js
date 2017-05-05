var path = require('path');
var pug = require('pug');
var through = require('through2');

module.exports = function () {
  return function (template, fn, data) {
    if (!fn) {
      fn = function () { return through() };
    }
    return function () {
      var req = arguments[0];
      var res = arguments[1];
      var m = arguments[2];

      if (m.session) {
        // if there is a session, pass it along to the template
        data.session = m.session;
      }

      res.setHeader('content-type', 'text/html');
      var theDataToSend = pug.renderFile(
        path.join(__dirname, '../templates', template), data
      );
      res.write(theDataToSend);
      res.end();
    };
  };
}
