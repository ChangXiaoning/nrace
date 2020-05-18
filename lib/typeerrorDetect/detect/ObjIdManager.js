

class WeakMapMetadataManager {
    constructor() {
        /**
         * WeakMap to hold the source ID at which we first encountered a native object.
         *
         * This is used to associate a correct IID with the native object if we
         * decide to create metadata for it.
         * @type {WeakMap<K, V>}
         */
        this.nativeObj2IID = new WeakMap();
        /**
         * WeakMap to hold object metadata
         * metadata is 32 bits.  31 bits for object id, highest-order bit to mark unannotated 'this'
         * objects from constructors
         * @type {WeakMap<K, V>}
         */
        this.obj2Metadata = new WeakMap();
    }
    hasMetadata(obj) {
        return this.obj2Metadata.has(obj);
    }
    getMetadata(obj) {
        return this.obj2Metadata.get(obj);
    }
    setMetadata(obj, metadata) {
        this.obj2Metadata.set(obj, metadata);
    }
}

class ObjIdManagerImpl {
    constructor() {
        /**
         * counter for object ids
         * @type {number}
         */
        this.idCounter = 0;
        this.metaManager = new WeakMapMetadataManager();
    }
    /**
     * get a unique id for the object, creating it if necessary.
     * If created, log a CREATE event
     * @param obj the object, precondition isObject(obj) === true
     * @returns {*}
     */
    findOrCreateUniqueId(obj, iid, isLiteral) {
        var meta = this.metaManager;
        if (meta.hasMetadata(obj)) {
            return this.extractObjId(meta.getMetadata(obj));
        }
        else {
            return this.createObjId(obj, iid, isLiteral);
        }
    }
    extractObjId(metadata) {
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
    findExtantObjId(obj) {
        return this.extractObjId(this.metaManager.getMetadata(obj));
    }
    findObjId(obj) {
        if (isObject(obj)) {
            var val = this.metaManager.getMetadata(obj);
            if (val !== undefined) {
                return this.extractObjId(val);
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
    createObjId(obj) {
        var meta = this.metaManager;
        
        var helper = (o) => {
            var objId = this.idCounter + 1;
            meta.setMetadata(o, objId);
            this.idCounter = objId;
            return objId;
        };
        var objId = helper(obj);
        
        return objId;
    }
    /**
     * do we have metadata for the object already?
     * @param obj
     * @returns {boolean}
     */
    hasMetadata(obj) {
        return this.metaManager.hasMetadata(obj);
    }
    getMetadata(obj) {
        return this.metaManager.getMetadata(obj);
    }
    setMetadata(obj, id) {
        return this.metaManager.setMetadata(obj, id);
    }
}
function createObjIdManager() {
    var result = 
        new ObjIdManagerImpl();
    // reserve object ID 1 for the global object
    //result.createObjId(GLOBAL_OBJ, -1, false);
    return result;
}
module.exports = createObjIdManager;

