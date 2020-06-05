const util = require('./util');

class MapMetadataManager {
    constructor() {
        /**
         * Map to hold the source ID at which we first encountered a base typed value.
         *
         * This is used to associate a correct IID with the base typed value if we
         * decide to create metadata for it.
         * @type {Map<K, V>}
         */
        this.baseTypedVal2IID = new Map();
        /**
         * Map to hold object metadata
         * metadata is 32 bits.  31 bits for object id, highest-order bit to mark unannotated 'this'
         * objects from constructors
         * @type {Map<K, V>}
         */
        this.baseTypedVal2Metadata = new Map();
    }
    hasMetadata(val) {
        return this.baseTypedVal2Metadata.has(val);
    }
    getMetadata(val) {
        return this.baseTypedVal2Metadata.get(val);
    }
    setMetadata(val, metadata) {
        this.baseTypedVal2Metadata.set(val, metadata);
    }
    setIIDForBaseTypedVal (val, iid) {
        this.baseTypedVal2IID.set(val, iid);
    }
    hasIIDForBaseTypedVal (val) {
        return this.baseTypedVal2IID.has(val);
    }
    getIIDForBaseTypedVal (val) {
        return this.baseTypedVal2IID.get(val);
    }
    flushBaseTypedValIIDInfo () {
        this.baseTypedVal2IID = new Map ();
    }
}

class BaseTypedValIdManagerImpl {
    constructor() {
        /**
         * counter for val ids
         * @type {number}
         */
        this.idCounter = 0;
        this.metaManager = new MapMetadataManager();
    }
    /**
     * get a unique id for the base typed value, creating it if necessary.
     * //If created, log a CREATE event
     * @param obj the object, precondition isObject(obj) === true
     * @returns {*}
     */
    findOrCreateUniqueId(val, iid, isLiteral) {
        var meta = this.metaManager;
        if (meta.hasMetadata(val)) {
            return this.extractValId(meta.getMetadata(val));
        }
        else {
            return this.createValId(val, iid, isLiteral);
        }
    }
    extractValId(metadata) {
        return metadata & 0x7FFFFFFF;
    }
    isUnannotatedThis(metadata) {
        return metadata < 0;
    }
    setUnannotatedThis(metadata) {
        // set sign bit
        return metadata | 0x80000000;
    }
    /**
     * gets unique id for object.  assumes that an ID has already been created.
     * @param obj
     * @returns {number}
     */
    findExtantObjId(val) {
        return this.extractValId(this.metaManager.getMetadata(val));
    }
    findObjId(val) {
        if (!(util.isObject(val))) {
            var meta = this.metaManager.getMetadata(val);
            if (meta !== undefined) {
                return this.extractValId(meta);
            }
        }
        return -1;
    }
    /**
     * is obj unannotated and in need of an id?  This is to handle
     * cases where we discover objects from native / uninstrumented code
     * @param obj
     */
    needsAnId(obj) {
        return isObject(obj) && !this.metaManager.hasMetadata(obj);
    }
    createValId(val) {
        var meta = this.metaManager;
        
        var helper = (val) => {
            var valId = this.idCounter + 1;
            meta.setMetadata(val, valId);
            this.idCounter = valId;
            return valId;
        };
        var valId = helper(val);
        
        return valId;
    }
    /**
     * do we have metadata for the object already?
     * @param val
     * @returns {boolean}
     */
    hasMetadata(val) {
        return this.metaManager.hasMetadata(val);
    }
    getMetadata(val) {
        return this.metaManager.getMetadata(val);
    }
    setMetadata(val, id) {
        return this.metaManager.setMetadata(val, id);
    }
}
function createBaseTypedValIdManager() {
    var result = new BaseTypedValIdManagerImpl();
    // reserve object ID 1 for the global object
    //result.createObjId(GLOBAL_OBJ, -1, false);
    return result;
}
module.exports = createBaseTypedValIdManager;

