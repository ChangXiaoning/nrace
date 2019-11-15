function isObject(o) {
    return o && (typeof o === 'object' || typeof o === 'function');
};

var objGetOwnPropDesc = Object.getOwnPropertyDescriptor;
var objGetPrototypeOf = Object.getPrototypeOf;
var objProtoHasOwnProperty = Object.prototype.hasOwnProperty;
var objDefProperty = Object.defineProperty;

var HOP = function () {

};

module.exports = {
    LogEntryType: require('./LogEntryType.js'),
    ALREADY_FLUSHED = "ALREADY_FLUSHED",
    UNKNOWN_FLUSH_LOC = "0:-1",
    //TODO: GLOBAL_OBJ
    isObject: isObject,
    HOP: HOP
};

(function (___TraceCollector___) {

    ___TraceCollector___.LogEntryType = require('./LogEntryType.js');
    ___TraceCollector___.ALREADY_FLUSHED = "ALREADY_FLUSHED";
    ___TraceCollector___.UNKNOWN_FLUSH_LOC = "0:-1";
    ___TraceCollector___.GLOBAL_OBJ = (function () {
        return this;
    })();
    function isObject(o) {
        return o && (typeof o === 'object' || typeof o === 'function');
    }
    ___TraceCollector___.isObject = isObject;
    // some defense against monkey-patching
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
    }
    ___TraceCollector___.getPropertyDescriptor = getPropertyDescriptor;
    function isGetterSetter(o, prop) {
        var desc = getPropertyDescriptor(o, prop);
        return desc && (desc.set !== undefined || desc.get !== undefined);
    }
    ___TraceCollector___.isGetterSetter = isGetterSetter;
    function HOP(o, prop) {
        return objProtoHasOwnProperty.call(o, prop);
    }
    ___TraceCollector___.HOP = HOP;
    function objDefineProperty(o, p, attributes) {
        return objDefProperty(o, p, attributes);
    }
    ___TraceCollector___.objDefineProperty = objDefineProperty;
    var funEnterRegExp = /J\$\.Fe\(([0-9]+)/;
    /**
     * cache for optimization
     * @type {WeakMap<K, V>}
     */
    var instFunction2EnterIID = typeof WeakMap === 'undefined' ? undefined : new WeakMap();
    var funEnterIIDHiddenProp = "*HP$*";
    ;
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
    }
    ___TraceCollector___.getFunEnterIID = getFunEnterIID;
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
    }
    function lookupCachedFunEnterIID(f) {
        if (instFunction2EnterIID) {
            return instFunction2EnterIID.get(f);
        }
        else {
            return f[funEnterIIDHiddenProp];
        }
    }
    ___TraceCollector___.lookupCachedFunEnterIID = lookupCachedFunEnterIID;
})(___TraceCollector___ || (___TraceCollector___ = {}));