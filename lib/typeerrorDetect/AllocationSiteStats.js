var logger = require('../../driver/logger.js').logger;

/**
 * 
 * @param {Number} lineno 
 * @param {String} objId 
 * @param {String} accessType
 * @param {String} iid
 * @param {String} eid
 * @param {String} location
 * Represent an object accessing record.
 * accessType can be found in AccessType
 * Note, identifier of ObjectRecord is lineno.
 */

 /**
  * Bug: currently, I confuse the objId and val
  */
function ObjectRecord (lineno, objId, accessType, iid, eid, location) {
    this.lineno = lineno;
    this.objId = objId;
    this.accessType = accessType;
    this.iid = iid;
    this.eid = eid;
    this.location = location;
};

function ObjectManager () {
    /**
     * the array to hold all objects, indexed by its objId, e.g., 
     * objects[objId] = objId just to save all objId.
     * Bug: objId can be <String>, so cannot use objId as index, just push it into this.objects
     */
    this.objects = new Array();
    /**
     * the dictionary to hold all ObjectRecord, indexed by its identifier lineno, e.g., 
     * records[lineno] = rcd <ObjectRecord>
     */
    this.records = {};
    /**
     * the dictionary to hold all ObjectRecord of an object, e.g., 
     * obj2rcds[objId] = [lineno] <Array>
     */
    this.obj2rcds = {};
};

/**
 * @param {ObjectRecord} rcd
 * save rcd into this.records and this.obj2rcds
 * specifically, if rcd is 'CREATE_OBJ', save it into this.objects
 */
ObjectManager.prototype.addObjRcd = function (rcd) {
    if (this.objects.indexOf(rcd.objId) == -1) {
        this.objects.push(rcd.objId);
    }
    this.records[rcd.lineno] = rcd;
    this.mapRcd2obj(rcd);
};

/**
 * @param {ObjectRecord} rcd
 */
ObjectManager.prototype.mapRcd2obj = function (rcd) {
    if (this.objects.indexOf(rcd.objId) == -1) {
        logger.error('objId ' + rcd.objId + ' has not saved before.');
        return;
    }
    if (!this.obj2rcds.hasOwnProperty(rcd.objId)){
        this.obj2rcds[rcd.objId] = new Array ();
    }
    this.obj2rcds[rcd.objId].push(rcd.lineno);
};

Object.prototype.searchForLastRead = function () {
    var index,
        keys = Object.keys(this.records);
    keys.sort(function (a, b) {
        return b-a;
    });
    for (var i = 0; i < keys.length; i++) {
        if (this.records[keys[i]].accessType == 'READ') {
            index = keys[i];
            break;
        }
    }
    return this.records[index];
};

module.exports = {
    ObjectRecord: ObjectRecord,
    ObjectManager: ObjectManager
};