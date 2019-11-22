var logger = require('../../driver/logger.js').logger,
    LogEntryType = require('../analysis/LogEntryType.js'),
    AccessType = require('./ObjAccessType'),
    lineReader = require('line-reader');

function TraceParser () {
    this.functionManager = new FunctionManager();
    this.eventManager = new EventManager();
    this.happensBeforeGraph = new HappensBeforeGraph();
    this.locationManager = new LocationManager();
};

TraceParser.prototype.parse = function (traceFile, cb){
    //in case cb is undefined
    cb = cb || function () {};
    logger.info('Begin parsing trace', (typeof traceFile == 'string' && traceFile.endsWith('.log')) ? traceFile : '');

    var lineno = 0,
        that = this,
        record,
        event;

    try{
        if (typeof(traceFile) == 'string') {
            if (!traceFile.endsWith('.log')) {
                //trace is the content string
                var lines = traceFile.split('\n');
                for (var i = 0; i < lines.length; i++) {
                    processLine(lines[i], i == lines.length - 1);
                }
            } else {
                //trace is the file
                lineReader.eachLine(traceFile, processLine);
            }
        } else if (typeof(traceFile) == 'object') {
            //trace has already been parsed
            logger.info('The trace has already been parsed.');
            cb();
        }
    }catch (e) {
        logger.error(e);
        throw e;
    }

    function processLine (line, last) {
        lineno++;
        record = undefined;
        event = undefined;
        if (line) {
            var metadata = line.split(','),
                entryType = metadata[0],
                entryTypeName;
            if(typeof(entryType) != 'number') {
                entryType = Number.parseInt(entryType);
            }
            if (!LogEntryType.hasOwnProperty(entryType)) {
                return;
            } else {
                entryTypeName = LogEntryType[entryType];
            }
            
            if (entryType == LogEntryType['SOURCE_MAPPING']){
                /**
                 * map each iid to location
                 * log format: entryType, iid, startLine, startColumn, endLine, endColumn
                 */
                locationManager.addiid(metadata[1], metadata.slice(2, 6));
            } else if (entryType == LogEntryType['SCRIPT_ENTER']) {
                /**
                 * for computing the location
                 * log format: entryType, iid, scriptId, filename
                 */
                that.locationManager.setScript(metadata[2]);
            } else if (entryType == LogEntryType['SCRIPT_EXIT']) {
                //log format: entryType, iid
                that.locationManager.clearScript();
            } else if (entryType == LogEntryType['DECLARE']) {
                //log format: entryType, iid, scope, name, objId
                var objAccessType = AccessType.entryType2accessType(entryTypeName);
                record = new ObjectRecord(lineno, metadata[4], objAccessType, metadata[1], that.eventManager.top(), that.locationManager.query(metadata[1]));
            } else if (entryType == LogEntryType['CREATE_OBJ']) {
                //object allocation format: entryType (metadata[0]), iid (metadata[1]), ObjId (metadata[2])
                var objAccessType = AccessType.entryType2accessType(entryTypeName);
                record = new ObjectRecord(lineno, metadata[2], objAccessType, metadata[1], that.eventManager.top(), that.locationManager.query(metadata[1]));

                //TODO: add more metadata for 'CREATE_OBJ' in TraceCollection
            } else if (entryType == LogEntryType['WRITE']) {
                //log format: entryType, iid, scope, name, objId
                var objAccessType = AccessType.entryType2accessType(entryTypeName);
                record = new ObjectRecord(lineno, metadata[3], objAccessType, metadata[1], that.eventManager.top(), that.locationManager.query(metadata[2]));
            } else if (entryType == LogEntryType['READ']) {
                /**
                 * TODO: object use: we need to monitor the operation after READ operation to determine what the dangerous usage is.
                 * log format: entryType, iid, scope, name, objId
                 * objId = -1: primitive variable; objId > 0: object value
                 */
                if (metadata[4] > 0) {
                    var objAccessType = AccessType.entryType2accessType(entryTypeName);
                    record = new ObjectRecord(lineno, metadata[3], objAccessType, metadata[1], that.eventManager.top(), that.locationManager.query(metadata[1]));
                }
            } else if (entryType == LogEntryType['PUTFIELD']) {
                //property write
                //log format: entryType, iid, base, propName, val,
                var objAccessType = AccessType.entryType2accessType(entryTypeName);
                record = new ObjectRecord(lineno, metadata[2], objAccessType, metadata[1], that.eventManager.top(), that.locationManager.query(metadata[1]));
                //identify the DELETE_PROP opeation
                if(metadata[4] == 0)
                    record.accessType = AccessType.entryType2accessType(objAccessType);
            } else if (entryType == LogEntryType['GETFIELD']) {
                //property read
                //TODO: if GETFIELD of an object is an object, I also consider it as a object use
                //log format: entryType, iid, base, propName, val
                var objAccessType = AccessType.entryType2accessType(entryTypeName);
                record = new ObjectRecord(lineno, metadata[2], objAccessType, metadata[1], that.eventManager.top(), that.locationManager.query(metadata[1]));
            } else if (entryType == LogEntryType['FUNCTION_ENTER']) {
                //log format: entryType, iid, funName
                that.functionManager.enter(metadata[1], metadata[2]);
            } else if () {
                //log format: entryType, iid
                that.functionManager.exit(metadata[1]);
            } else if (entryType == LogEntryType['ASYNC_INIT']) {
                //log format: entryType, asyncId, type, prior
                event = new Event(metadata[1], metadata[3], metadata[2]);
                that.eventManager.addEvent(event);
            } else if (entryType == LogEntryType['ASYNC_BEFORE']) {
                //log format: entryType, asyncId
                that.eventManager.enter(metadata[1]);
            } else if (entryType == LogEntryType['ASYNC_AFTER']) {
                //log format: entryType, asyncId
                that.eventManager.exit(metadata[1]);
            } else if (entryType == LogEntryType['ASYNC_PROMISERESOLVE']) {
                //log format: entryType, asyncId, eid
                //TODO: maybe insuitable
                event = new Event(metadata[1], metadata[2], 'PROMISE');
                that.eventManager.addEvent(event);
            }
        }
        //associate object accessing record with event
        if (record instanceof ObjectRecord) {

        }
        //all records are parsed. build happens-before graph for events. detect
        if (last) {
            logger.info('End parsing.');
            that.happensBeforeGraph.ready();
            cb();
        }
    };
};

/******************************/
/*********Data Structure*******/
/******************************/

/**
* LocationManager is used for location computation, e.g., 
* LocationManager[iid] = location <Array>
*/

function LocationManager () {
    this.currentSourceScript = undefined;
    this.iid2location = {};
};

/**
 * @param {String} filename
 */
LocationManager.prototype.setScript = function (filename) {
    this.currentSourceScript = filename
};

LocationManager.prototype.clearScript = function () {
    this.currentSourceScript = undefined;
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
    var arr = new Array(this.currentSourceScript);
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
}
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
        this.objects[rcd.objId] = rcd.objId;
    }
    this.records[rcd.lineno] = rcd;
    this.mapRcd2obj(rcd);
};

/**
 * @param {ObjectRecord} rcd
 */
ObjectManager.prototype.mapRcd2obj = function (rcd) {
    if (this.objects.indexOf(rcd.objId) == -1) {
        logger.error('objId ' + rcd.objId + 'has not saved before.');
        return;
    }
    if (!this.obj2rcds.hasOwnProperty(rcd.objId)){
        this.obj2rcds[rcd.objId] = new Array ();
    }
    this.obj2rcds[rcd.objId].push(rcd.lineno);
};

/**
 * 
 * @param {String} iid 
 * @param {String} name 
 */
function Function (iid, name) {
    this.iid = iid;
    this.name = name;
    this.isExplicitReturn = false;
};

/**
 * used to match up functionEnter()/functionExit() because function argument f is not available in functionExit
 * each element of the stack is an instance of Function class
 * where the isExplicitReturn indicates if we have seen
 * an explicit return for this function.
 */
function FunctionManager () {
    this.stack = new Array();
    this.counts = {};
    this.vars = {};
};

FunctionManager.prototype.enter = function (iid, name) {
    var func = new Function (iid, name);
    this.stack.push(func);
    this.counts[iid] = this.counts[iid] || 0;
    this.counts[iid] += 1
    this.vars[this.getId()] = this.vars[this.getId()] || {};
};

FunctionManager.prototype.declare = function (name) {
    if (!this.vars[this.getId()]) {
        logger.error('Lack a FUNCTION_ENTER operation ...');
    }
    this.vars[this.getId()][name] = true;
};

FunctionManager.prototype.return = function () {
    this.top().isExplicitReturn = true;
};

FunctionManager.prototype.exit = function (iid) {
    var f = this.stack.pop();
    if (f.iid != iid) {
        logger.error('Function_exit iid differs with Function_enter iid');
    }
};

/**
 * @return {Function}
 */
FunctionManager.prototype.top = function () {
    return this.stack[this.stack.length - 1];
};

FunctionManager.prototype.getId = function () {
    var currentFunciid = this.top().iid;
    return currentFunciid + this.counts[currentFunciid];
};

function Event (asyncId, prior, resourceType) {
    this.id = asyncId;
    this.prior = prior;
    this.priority = resourceType2priority(resourceType);
};

function EventManager () {
    /**
     * hold all events, indexed by asyncId, e.g., 
     * events[asyncId] = e <Event>
     */
    this.events = new Array();
    /**
     * hold all ObjectRecord performed by this event, e.g., 
     * event2objRcds[asyncId] = [lineno] <Array>
     */
    this.event2objRcds = {};
    /**
     * model the call stack, to trace the current event
     */
    this.stack = new Array ();
};

/**
 * @param {Event} event
 * add event into this.events
 */
EventManager.prototype.addEvent = function (event) {
    if(this.events.hasOwnProperty(event.id)) {
        logger.error('There already has been an event with id' + event.id);
    } else {
        this.events[event.id] = event;
    }
};

/**
 * @param <String>
 */
EventManager.prototype.enter = function (id) {
    this.stack.push(id);
};

/**
 * @param <String>
 */
EventManager.prototype.exit = function (id) {
    if (this.stack.top != id) {
        logger.error('Something wrong event exiting does not equal to the top of stack, id: ' + id);
    } else {
        this.stack.pop();
    }
};

/**
 * @return {String}
 * id of current event
 */
EventManager.prototype.top = function () {
    return this.stack[length(this.stack) - 1];
}

/**
 * @param {ObjectRecord} objRcd
 * add ObjectRecord into this.event2objRcds
 */
EventsManager.prototype.addObjRcd = function (objRcd) {
    if (!this.event2objRcds.hasOwnProperty(objRcd.eid)) {
        this.event2objRcds[objRcd.eid] = new Array();
    };
    this.event2objRcds[objRcd.eid].push(objRcd.lineno);
};

function HappensBeforeGraph () {
    this.nodes = {};
    this.edges = {};
}

HappensBeforeGraph.prototype.ready = function () {
    logger.info('start to build happens-before graph ...');
};

/**
 * Each object has a PropertyManager instance, which manages dynamic properties.
 * Specifically, PropertyManger holds the property name, type of property value.
 * @param {string} id: id is the objId read from the trace file 
 */
function PropertyManager (id) {
    /**
     * unique identifier of PropertyManager is objId
     */
    this.objId = id;
    /**
     * @type{Map<propertyName, [propertyValue, propertyType]>}
     * TODO: propertyValue is necessary?
     * e.g., an element in this.propertyMap should be <propName, [propertyValue, propertyType]>
     */
    this.propertyMap = new Map();
};

PropertyManager.prototype.has = function (name) {
    return this.propertyMap.has(name);
};

PropertyManager.prototype.set = function(name, val, type) {
    var tuple = [val, type];
    this.propertyMap.set(name, tuple);
};

/**
 * return the type of the property value, given the property name.
 * Assume the property is in Map
 */
PropertyManager.prototype.getType = function (name) {
    return this.propertyMap.get(name)[1];
}

PointToManager.prototype.set = function () {};

function PointToManager () {
    this.map = {};
};

/******************************/
/*************Method***********/
/******************************/

/**
 * FSEVENTWRAP, FSREQWRAP, GETADDRINFOREQWRAP, GETNAMEINFOREQWRAP, HTTPPARSER,
 * JSSTREAM, PIPECONNECTWRAP, PIPEWRAP, PROCESSWRAP, QUERYWRAP, SHUTDOWNWRAP,
 * SIGNALWRAP, STATWATCHER, TCPCONNECTWRAP, TCPWRAP, TIMERWRAP, TTYWRAP,
 * UDPSENDWRAP, UDPWRAP, WRITEWRAP, ZLIB, SSLCONNECTION, PBKDF2REQUEST,
 * RANDOMBYTESREQUEST, TLSWRAP, Timeout, Immediate, TickObject
 * TickObject: 1, Timeout: 2, Immediate: 2, Other: 3
 * @param {String} resourceType 
 */
function resourceType2priority (resourceType) {
    switch(resourceType) {
        case 'TickObject':
            return 1;
        case 'Timeout':
            return 2;
        case 'Immediate':
            return 2;
        default:
            return 3;
    }
};

exports.TraceParser = TraceParser;