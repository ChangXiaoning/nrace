var logger = require('../../driver/logger.js').logger;
/**
* LocationManager is used for location computation, e.g., 
* LocationManager[iid] = location <Array>
*/

function LocationManager () {
    this.currentScript = null;
    this.iid2location = {};
};

/**
 * @param {String} filename
 */
LocationManager.prototype.setScript = function (filename) {
    this.currentScript = filename;
};

/**
 * @param {String} iid
 * @param {Array} location
 */
LocationManager.prototype.addiid = function (iid, location) {
    if (this.iid2location.hasOwnProperty(iid)) {
        logger.error('This iid has already saved');
        return;
    }
    this.iid2location[iid] = location;
};

/**
 * @return {String}
 * return the location: script#startLine#startColumn#endLine#endColumn
 */
LocationManager.prototype.query = function (iid) {
    var arr = new Array(this.currentScript);
    arr.push(this.iid2location[iid]);
    return arr.join('#');
}

/**
 * To reduce the size of a ObjectRecord, do not save location attribute in ObjetRecord
 * @param {ObjectRecord}
 * @return {String}: return the location of rcd 
 */
LocationManager.prototype.queryByRcd = function (rcd) {
    return this.query(rcd.iid);
};

module.exports = LocationManager;