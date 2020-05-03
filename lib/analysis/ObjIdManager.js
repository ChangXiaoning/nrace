var util = require('./util');
var WeakMapMetadataManager = (function () {
    function WeakMapMetadataManager() {
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
    WeakMapMetadataManager.prototype.hasMetadata = function (obj) {
        return this.obj2Metadata.has(obj);
    };
    WeakMapMetadataManager.prototype.getMetadata = function (obj) {
        return this.obj2Metadata.get(obj);
    };
    WeakMapMetadataManager.prototype.setMetadata = function (obj, metadata) {
        this.obj2Metadata.set(obj, metadata);
    };
    WeakMapMetadataManager.prototype.setIIDForNativeObj = function (obj, iid) {
        this.nativeObj2IID.set(obj, iid);
    };
    WeakMapMetadataManager.prototype.hasIIDForNativeObj = function (obj) {
        return this.nativeObj2IID.has(obj);
    };
    WeakMapMetadataManager.prototype.getIIDForNativeObj = function (obj) {
        return this.nativeObj2IID.get(obj);
    };
    WeakMapMetadataManager.prototype.flushNativeObj2IIDInfo = function () {
        this.nativeObj2IID = new WeakMap();
    };
    return WeakMapMetadataManager;
})();

var HiddenPropMetadataManager = (function () {
    function HiddenPropMetadataManager() {
        if (typeof Object.defineProperty !== 'function') {
            throw new Error("we need Object.defineProperty");
        }
    }
    HiddenPropMetadataManager.prototype.hasMetadata = function (obj) {
        return util.HOP(obj, HiddenPropMetadataManager.METADATA_PROP);
    };
    HiddenPropMetadataManager.prototype.getMetadata = function (obj) {
        return obj[HiddenPropMetadataManager.METADATA_PROP];
    };
    HiddenPropMetadataManager.prototype.setMetadata = function (obj, metadata) {
        if (!this.hasMetadata(obj)) {
            try {
                util.objDefineProperty(obj, HiddenPropMetadataManager.METADATA_PROP, {
                    enumerable: false,
                    writable: true
                });
            }
            catch (e) {
            }
        }
        obj[HiddenPropMetadataManager.METADATA_PROP] = metadata;
    };
    HiddenPropMetadataManager.prototype.setIIDForNativeObj = function (obj, iid) {
        util.objDefineProperty(obj, HiddenPropMetadataManager.NATIVE_IID_PROP, {
            enumerable: false,
            writable: true
        });
        obj[HiddenPropMetadataManager.NATIVE_IID_PROP] = iid;
    };
    HiddenPropMetadataManager.prototype.hasIIDForNativeObj = function (obj) {
        return util.HOP(obj, HiddenPropMetadataManager.NATIVE_IID_PROP);
    };
    HiddenPropMetadataManager.prototype.getIIDForNativeObj = function (obj) {
        return obj[HiddenPropMetadataManager.NATIVE_IID_PROP];
    };
    HiddenPropMetadataManager.prototype.flushNativeObj2IIDInfo = function () {
        // do nothing
    };
    HiddenPropMetadataManager.METADATA_PROP = "*M$*";
    HiddenPropMetadataManager.NATIVE_IID_PROP = "*NI$*";
    return HiddenPropMetadataManager;
})();

var ObjIdManagerImpl = (function () {
    function ObjIdManagerImpl(tracer, metaManager) {
        /**
         * counter for object ids
         * @type {number}
         */
        this.idCounter = 1;
        this.tracer = tracer;
        this.metaManager = metaManager;
    }
    /**
     * get a unique id for the object, creating it if necessary.
     * If created, log a CREATE event
     * @param obj the object, precondition isObject(obj) === true
     * @returns {*}
     */
    ObjIdManagerImpl.prototype.findOrCreateUniqueId = function (obj, iid, isLiteral, name) {
        if(!util.isObject(obj)){
            if (util.isUndefined(obj)) return -2;
            if (util.isNull(obj))  return -3;
            else return 0;
        }
        var meta = this.metaManager;
        if (meta.hasMetadata(obj)) {
            return this.extractObjId(meta.getMetadata(obj));
        }
        else {
            return this.createObjId(obj, iid, isLiteral, name);
        }
    };
    ObjIdManagerImpl.prototype.extractObjId = function (metadata) {
        return metadata & 0x7FFFFFFF;
    };
    ObjIdManagerImpl.prototype.isUnannotatedThis = function (metadata) {
        return metadata < 0;
    };
    ObjIdManagerImpl.prototype.setUnannotatedThis = function (metadata) {
        // set sign bit
        return metadata | 0x80000000;
    };
    /**
     * gets unique id for object.  assumes that an ID has already been created.
     * @param obj
     * @returns {number}
     */
    ObjIdManagerImpl.prototype.findExtantObjId = function (obj) {
        return this.extractObjId(this.metaManager.getMetadata(obj));
    };
    ObjIdManagerImpl.prototype.findObjId = function (obj) {
        if (util.isObject(obj)) {
            var val = this.metaManager.getMetadata(obj);
            if (val !== undefined) {
                return this.extractObjId(val);
            }
        }
        return -1;
    };
    /**
     * is obj unannotated and in need of an id?  This is to handle
     * cases where we discover objects from native / uninstrumented code
     * @param obj
     */
    ObjIdManagerImpl.prototype.needsAnId = function (obj) {
        return util.isObject(obj) && !this.metaManager.hasMetadata(obj);
    };
    /**
     * If createObjId for READ operation, pass name to createObjId method
     */
    ObjIdManagerImpl.prototype.createObjId = function (obj, iid, isLiteral, name) {
        var _this = this;
        var meta = this.metaManager;
        var allocIID;
        var allocScriptId;
        var diffScriptId;
        if (meta.hasIIDForNativeObj(obj)) {
            var sourceId = meta.getIIDForNativeObj(obj);
            var colonInd = sourceId.indexOf(':');
            allocScriptId = parseInt(sourceId.substring(0, colonInd));
            allocIID = parseInt(sourceId.substring(colonInd + 1));
            diffScriptId = allocScriptId !== J$.sid;
        }
        else {
            allocScriptId = J$.sid;
            allocIID = iid;
            diffScriptId = false;
        }
        var helper = function (o) {
            var objId = _this.idCounter + 2;
            meta.setMetadata(o, objId);
            _this.idCounter = objId;
            return objId;
        };
        var objId = helper(obj);
        // only emit the CREATE_FUN entry for function literals
        if (isLiteral && typeof obj === 'function' && name != undefined) {
            // create ID for prototype as well
            var proto = obj.prototype;
            // prototype can be undefined for getters / setters
            if (proto !== undefined) {
                helper(proto);
            }
            var funEnterIID = util.getFunEnterIID(obj);
            this.tracer.logCreateFun(allocIID, funEnterIID, objId, name);
        }
        else {
            if (diffScriptId) {
                this.tracer.logCreateObjDiffScript(allocScriptId, allocIID, objId);
            }
            else {
                this.tracer.logCreateObj(allocIID, objId);
            }
        }
        return objId;
    };
    /**
     * do we have metadata for the object already?
     * @param obj
     * @returns {boolean}
     */
    ObjIdManagerImpl.prototype.hasMetadata = function (obj) {
        return this.metaManager.hasMetadata(obj);
    };
    ObjIdManagerImpl.prototype.getMetadata = function (obj) {
        return this.metaManager.getMetadata(obj);
    };
    ObjIdManagerImpl.prototype.setMetadata = function (obj, id) {
        return this.metaManager.setMetadata(obj, id);
    };
    ObjIdManagerImpl.prototype.flushNativeObj2IIDInfo = function () {
        this.metaManager.flushNativeObj2IIDInfo();
    };
    ObjIdManagerImpl.prototype.setSourceIdForNativeObj = function (obj, sourceId) {
        this.metaManager.setIIDForNativeObj(obj, sourceId);
    };
    return ObjIdManagerImpl;
})();

function createObjIdManager(tracer, useHiddenProp) {
    if (useHiddenProp === void 0) { useHiddenProp = false; }
    //console.log('useHiddenProp is: ', useHiddenProp);
    var result = typeof WeakMap === 'undefined' || useHiddenProp ? new ObjIdManagerImpl(tracer, new HiddenPropMetadataManager()) : new ObjIdManagerImpl(tracer, new WeakMapMetadataManager());
    // reserve object ID 1 for the global object
    //console.log('type of idManager: ', (result instanceof HiddenPropMetadataManager));
    result.createObjId(util.GLOBAL_OBJ, -1, false);
    return result;
}

//console.log(typeof(createObjIdManager));

module.exports = createObjIdManager;