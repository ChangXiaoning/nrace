var LogEntryType = require('./LogEntryType.js'),
    ALREADY_FLUSHED = "ALREADY_FLUSHED",
    UNKNOWN_FLUSH_LOC = "0:-1",
    GLOBAL_OBJ = (function () {
        return this;
    })();

function isObject(o) {
    return o && (typeof o === 'object' || typeof o === 'function');
};

var objGetOwnPropDesc = Object.getOwnPropertyDescriptor;
var objGetPrototypeOf = Object.getPrototypeOf;
var objProtoHasOwnProperty = Object.prototype.hasOwnProperty;
var objDefProperty = Object.defineProperty;

function getPropertyDescriptor(o, prop) {
    var t = o;
    while (t != null) {
        var desc = objGetOwnPropDesc(t, prop);
        if (desc) {
            return desc;
        }
        t = objGetPrototypeOf(t);
    }
    return null;
};

function isGetterSetter(o, prop) {
    var desc = getPropertyDescriptor(o, prop);
    return desc && (desc.set !== undefined || desc.get !== undefined);
}

function HOP(o, prop) {
    return objProtoHasOwnProperty.call(o, prop);
};

function objDefineProperty(o, p, attributes) {
    return objDefProperty(o, p, attributes);
}；

var funEnterRegExp = /J\$\.Fe\(([0-9]+)/;
/**
* cache for optimization
* @type {WeakMap<K, V>}
*/
var instFunction2EnterIID = typeof WeakMap === 'undefined' ? undefined : new WeakMap();
var funEnterIIDHiddenProp = "*HP$*";

function getFunEnterIID(f) {
    var parsed = funEnterRegExp.exec(f.toString());
    var result;
    if (parsed) {
        result = parseInt(parsed[1]);
        setCachedFunEnterIID(f, result);
    }
    else {
        result = -1;
    }
    return result;
};

function setCachedFunEnterIID(f, enterIID) {
    if (instFunction2EnterIID) {
        instFunction2EnterIID.set(f, enterIID);
    }
    else {
        // use a hidden property
        objDefineProperty(f, funEnterIIDHiddenProp, {
            enumerable: false,
            writable: true
        });
        f[funEnterIIDHiddenProp] = enterIID;
    }
};

function lookupCachedFunEnterIID(f) {
    if (instFunction2EnterIID) {
        return instFunction2EnterIID.get(f);
    }
    else {
        return f[funEnterIIDHiddenProp];
    }
};

module.exports = {
    LogEntryType: LogEntryType,
    ALREADY_FLUSHED: ALREADY_FLUSHED,
    UNKNOWN_FLUSH_LOC: UNKNOWN_FLUSH_LOC,
    GLOBAL_OBJ: GLOBAL_OBJ,
    isObject: isObject,
    getPropertyDescriptor: getPropertyDescriptor,
    isGetterSetter: isGetterSetter,
    HOP: HOP,
    objDefineProperty: objDefineProperty,
    getFunEnterIID: getFunEnterIID,
    lookupCachedFunEnterIID: lookupCachedFunEnterIID
};