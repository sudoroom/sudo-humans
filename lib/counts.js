module.exports = function (db) {
  return { add: add, get: get };

  /**
   * Add to the database's count for one or more keys.
   *
   * For each (key, value) pair passed in the values parameter, add value
   * to the database's existing stored value for that key. If no value is
   * stored, set that value. Values are coerced as need to the Number type.
   * If a value in values is something other than a number, it will clobber
   * the existing stored value, replacing it with NaN.
   *
   * @param {Object} values - key/value pairs to be processed
   * @param {function} cb - callback passed through to db.put()
   */
  function add (values, cb) {
    get(function (err, cur) {
      if (!cur) cur = {};
      Object.keys(values).forEach(function (key) {
        cur[key] = Number(cur[key] || 0) + Number(values[key]);
      });
      db.put('counts', cur, cb);
    });
  }

  /**
   * Get all of the current count data from the database.
   *
   * @param {function} cb - callback which receives the (err, counts)
   */
  function get (cb) {
    db.get('counts', function (err, counts) {
      if (err && err.type === 'NotFoundError') {
        // mask NotFoundError by simply providing no data
        cb(null, {});
      } else {
        cb(err, counts);
      }
    });
  }
};
