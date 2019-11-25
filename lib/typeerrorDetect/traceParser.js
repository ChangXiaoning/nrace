var logger = require('../../driver/logger.js').logger,
    LogEntryType = require('../analysis/LogEntryType.js'),
    AccessType = require('./ObjAccessType'),
    lineReader = require('line-reader');

//import data structure
var LocationManager = require('./LocationManager'),
    AllocationSiteStats = require('./AllocationSiteStats'),
    ObjectRecord = AllocationSiteStats.ObjectRecord,
    ObjectManager = AllocationSiteStats.ObjectManager,
    FunctionManager = require('./FunctionManager'),
    Event = require('./Event').Event,
    EventManager = require('./Event').EventManager,
    HappensBeforeGraph = require('./HappensBeforeGraph');

function TraceParser () {
    this.objectManager = new ObjectManager();
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
                that.locationManager.scriptEnter(metadata[3]);
            } else if (entryType == LogEntryType['SCRIPT_EXIT']) {
                //log format: entryType, iid
                that.locationManager.scriptExit();
            } else if (entryType == LogEntryType['CREATE_OBJ']) {
                //object allocation format: entryType (metadata[0]), iid (metadata[1]), ObjId (metadata[2])
                var objAccessType = AccessType.entryType2accessType(entryTypeName);
                record = new ObjectRecord(lineno, metadata[2], objAccessType, metadata[1], that.eventManager.top(), that.locationManager.query(metadata[1]));

                //TODO: add more metadata for 'CREATE_OBJ' in TraceCollection
            } else if (entryType == LogEntryType['CREATE_FUN']) {
                /**
                 * log format: entryType, iid, objId
                 * Two target: 1. create obj; 2. localize function
                 */
                var objAccessType = AccessType.entryType2accessType(entryTypeName);
                record = new ObjectRecord(lineno, metadata[2], objAccessType, metadata[1], that.eventManager.top(), that.locationManager.query(metadata[1]));
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
            } else if (entryType == LogEntryType['INVOKE_FUN']) {
                //log format: entryType, iid, fName, args

            } else if (entryType == LogEntryType['FUNCTION_ENTER']) {
                //log format: entryType, iid, funName
                that.functionManager.enter(metadata[1], metadata[2]);
            } else if (entryType == LogEntryType['DECLARE']) {
                //log format: entryType, iid, scope,name, val
                that.functionManager.declare(metadata[3]);
            } else if (entryType == LogEntryType['RETURN']) {
                //log format: entryType, iid, val
                that.functionManager.return();
            } else if (entryType == LogEntryType['FUNCTION_EXIT']) {
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
        
        if (record instanceof ObjectRecord) {
            ObjectManager.addObjRcd(record);
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

exports.TraceParser = TraceParser;