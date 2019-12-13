var logger = require('../../driver/logger.js').logger,
    LogEntryType = require('../analysis/LogEntryType.js'),
    AccessType = require('./ObjAccessType'),
    lineReader = require('line-reader');

//import data structure
var LocationManager = require('./LocationManager'),
    AllocationSiteStats = require('./AllocationSiteStats'),
    ObjectRecord = AllocationSiteStats.ObjectRecord,
    ObjectManager = AllocationSiteStats.ObjectManager,
    Function = require('./FunctionManager').Function,
    FunctionManager = require('./FunctionManager').FunctionManager,
    Event = require('./Event').Event,
    EventManager = require('./Event').EventManager,
    FileIO = require('./FileIO').FileIO,
    FileIOManager = require('./FileIO').FileIOManager,
    HappensBeforeGraph = require('./HappensBeforeGraph');

/** this variable is used to debug. true is to debug*/
var debug = true;
var debugHelper = require('./debug').debugHelper,
    print_array = require('./debug').print_array,
    writeObj = require('./debug').writeObj;

function TraceParser () {
    this.objectManager = new ObjectManager();
    this.functionManager = new FunctionManager();
    this.eventManager = new EventManager();
    this.fileIOManager = new FileIOManager();
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
        //fileIO,
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
        //fileIO = undefined;
        event = undefined;
        
        /** debug */
        if (debug) {
            debugHelper('===============' + lineno);
            debugHelper(line);
        }

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
                that.locationManager.addiid(metadata[1], metadata.slice(2, 6).join('#'));
            } else if (entryType == LogEntryType['SCRIPT_ENTER']) {
                /**
                 * for computing the location
                 * log format: entryType, iid, scriptId, filename
                 */
                that.locationManager.scriptEnter(metadata[3]);
                /**
                 * Model the global script as a function 
                 * Use the filename as the function name
                */
                that.functionManager.enter(metadata[1], metadata[3]);
                /**
                 * Model the global script as a big event,
                 * whose asyncId is -1
                 */
                event = new Event(lineno, Event.GLOBAL_EVENT, Event.GLOBAL_PRIOR, Event.GLOBAL_RESOURCETYPE);
                that.eventManager.addEvent(event);
                that.eventManager.enter(event.id);
            } else if (entryType == LogEntryType['SCRIPT_EXIT']) {
                //log format: entryType, iid
                that.locationManager.scriptExit();
                /**
                 * Model the global script as a function 
                 * Use the filename as the function name
                */
                that.functionManager.exit(metadata[1]);
                /**
                 * Model the global script as a big event,
                 * whose asyncId is -1
                 */
                that.eventManager.exit(Event.GLOBAL_EVENT);
            } else if (entryType == LogEntryType['CREATE_OBJ']) {
                //object allocation format: entryType (metadata[0]), iid (metadata[1]), ObjId (metadata[2])
                var objAccessType = AccessType.entryType2accessType(entryTypeName);
                record = new ObjectRecord(lineno, metadata[2], objAccessType, metadata[1], that.eventManager.top(), that.locationManager.query(metadata[1]));

                //TODO: add more metadata for 'CREATE_OBJ' in TraceCollection
            } else if (entryType == LogEntryType['CREATE_FUN']) {
                /**
                 * log format: entryType, iid, functionEnterIid, objId, name
                 * Two target: 1. create obj; 2. localize function
                 */
                var objAccessType = AccessType.entryType2accessType(entryTypeName);
                record = new ObjectRecord(lineno, metadata[3], objAccessType, metadata[1], that.eventManager.top(), that.locationManager.query(metadata[1]));
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
                /**
                 * log format: entryType, iid, fName, args
                 * If fName is empty, invoking a fs related api, then use READ to locate callee function
                 * Else, use fName in INVOKE_FUN to locate callee function
                 * In a word, we use the location of callee function, where the event is registered,
                 * as the location of event
                 * TODO: is it problem?
                 */
                /* not package callback
                var fName, location;
                if (metadata[2] != '') {
                    fName = metadata[2];
                    location = that.locationManager.query(metadata[1]);
                } else {
                    var lastReadRcd = that.objectManager.searchForLastRead();
                    fName = lastReadRcd.objId;
                    location = lastReadRcd.location;
                }
                event =  that.eventManager.lastEvent();
                event.addRegisterByAPI(fName);
                event.addLocation(location);
                */
            } else if (entryType == LogEntryType['FUNCTION_ENTER']) {
                //log format: entryType, iid, funName
                that.functionManager.enter(metadata[1], metadata[2]);
            } else if (entryType == LogEntryType['DECLARE']) {
                //log format: entryType, iid, scope,name, val
                that.functionManager.declare(metadata[3]);
                var accessType = AccessType.entryType2accessType(entryTypeName);
                record = new ObjectRecord(lineno, metadata[3], accessType, metadata[1], that.eventManager.top(), that.locationManager.query(metadata[1]));
            } else if (entryType == LogEntryType['RETURN']) {
                //log format: entryType, iid, val
                that.functionManager.return();
            } else if (entryType == LogEntryType['FUNCTION_EXIT']) {
                //log format: entryType, iid
                that.functionManager.exit(metadata[1]);
            /**
             * Event related parsing
             */
            } else if (entryType == LogEntryType['ASYNC_INIT']) {
                //log format: entryType, asyncId, type, prior
                event = new Event(lineno, metadata[1], metadata[3], metadata[2]);
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
                event = new Event(lineno, metadata[1], metadata[2], 'PROMISE');
                that.eventManager.addEvent(event);
            /**
             * IO related parsing
             */
            } else if (isFileIO(entryType)) {
                /** log format:
                 * entryType, resource, ref, funName, lastAsyncId, location, isAsync
                 */
                var isAsync = (metadata[6] == '1')? true : false;
                record = new FileIO(lineno, metadata[1], LogEntryType[entryType], isAsync, that.eventManager.top(), metadata[4]);
            }
        }
        
        if (record instanceof ObjectRecord) {
            /**
             * Different script will create a new object in trace 
             * Currently, I ignore OBJECT_CREATE caused by different script when debugging
             * Bug: first create a new object, then SOURCE_MAPPING, then read/write execution
             * record.accessType == 'CREATE_OBJ' && record.iid == '-1'
            */
            if (record.iid != '-1') {
                that.objectManager.addObjRcd(record);
                if (debug) {
                    //debugHelper(record);
                }
                var ev = that.eventManager.events[record.eid];
                ev.addMemOp(record.lineno);
            }
        } else if (record instanceof FileIO) {
            that.fileIOManager.addFileIO(record);
        }
        //all records are parsed. build happens-before graph for events. detect
        if (last) {
            logger.info('End parsing.');
            /** Test the result of TraceParser */
            /*
            if (debug) {
                logger.debug('that.objectManager');
                debugHelper('records:');
                Object.keys(that.objectManager.records).forEach(function (lineno) {
                    var rcd = that.objectManager.records[lineno];
                    if (rcd.eid == '13') writeObj(rcd);
                })
                //print_array(that.objectManager.records);
                //writeObj(that.objectManager);
            }
            */
            /** Test the event result of TraceParser */
            /*
            Object.keys(that.eventManager.events).forEach(function (asyncId) {
                var e = that.eventManager.events[asyncId];
                debugHelper('==========' + asyncId);
                writeObj(e);
            })
            */
            //that.eventManager.wrapEvent();
            /**
             * For each asynchronous file IO record,
             * associate its follower callback to it
             */
            Object.keys(that.fileIOManager.fileIOs).forEach(function (lineno) {
                var rcd = that.fileIOManager.fileIOs[lineno];
                if (rcd.isAsync) {
                    rcd.followerCb = that.eventManager.wrapFileEvent(rcd.lastAsync);
                }
            })
            /** Test the result of wrap file event*/
            /*
            if (debug) {
                Object.keys(that.fileIOManager.fileIOs).forEach(function (lineno) {
                    var rcd = that.fileIOManager.fileIOs[lineno];
                    if (rcd.isAsync) {
                        writeObj(rcd);
                        debugHelper(rcd.followerCb);
                    }
                });
            }
            */
            that.happensBeforeGraph.ready(that.eventManager.events, that.fileIOManager.fileIOs);
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

function isFileIO (entryType) {
    return entryType == LogEntryType['FS_OPEN'] ||
           entryType == LogEntryType['FS_READ'] ||
           entryType == LogEntryType['FS_WRITE'] ||
           entryType == LogEntryType['FS_CLOSE'] ||
           entryType == LogEntryType['FS_DELETE'] ||
           entryType == LogEntryType['FS_CREATE'] ||
           entryType == LogEntryType['FS_STAT'];
}

exports.TraceParser = TraceParser;