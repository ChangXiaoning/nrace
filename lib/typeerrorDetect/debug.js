var fs = require('fs'),
    util = require('util');

/**
 * 
 * @param {String|Object} x 
 */
function debugHelper (x) {
    fs.writeSync(1, `${util.format(x)}\n`);
};

module.exports = debugHelper;