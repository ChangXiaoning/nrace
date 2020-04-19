var logger = require('../../driver/logger.js').logger,
    LogEntryType = require('../analysis/LogEntryType.js'),
    AccessType = require('./ObjAccessType'),
    lineReader = require('line-reader');

/**
 * Different script will create a new object in trace 
 * Currently, I ignore OBJECT_CREATE caused by different script when debugging
 * Bug: first create a new object, then SOURCE_MAPPING, then read/write execution
 * record.accessType == 'CREATE_OBJ' && record.iid == '-1'
*/

//import data structure
var LocationManager = require('./LocationManager'),
    AllocationSiteStats = require('./AllocationSiteStats'),
    ObjectRecord = AllocationSiteStats.ObjectRecord,
    ObjectManager = AllocationSiteStats.ObjectManager,
    Function = require('./FunctionManager').Function,
    FunctionManager = require('./FunctionManager').FunctionManager,
    Event = require('./Event').Event,
    EventManager = require('./Event').EventManager,
    EventOperation = require('./Event').EventOperation,
    FileIO = require('./FileIO').FileIO,
    FileIOManager = require('./FileIO').FileIOManager,
    HappensBeforeGraph = require('./HappensBeforeGraph').HappensBeforeGraph;

/** This structure is to extract events from the trace */
var AsyncObjectsBuilder = require('./AsyncObjectsBuilder'),
    builder = new AsyncObjectsBuilder();
var buildHBGraph = require('./hb/index');
const AccessBuilder = require('./AccessBuilder'),
    accessBuilder = new AccessBuilder();

/** this variable is used to debug. true is to debug*/
var debug = false;
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
        event,
        eventOp,
        triggerOp;

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
        record = null;
        event = null;
        
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
                that.locationManager.setScript(metadata[3]);
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
                //that.locationManager.scriptExit();
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
                record = accessBuilder.push({
                    name: metadata[3],
                    val: metadata[4], //TODO
                    entryType: "WRITE",
                    e: builder.getCurrentEvent(),
                    lineno: lineno,
                    iid: metadata[1],
                    location: that.locationManager.query(metadata[1]),
                });
            } else if (entryType == LogEntryType['READ']) {
                /**
                 * TODO: object use: we need to monitor the operation after READ operation to determine what the dangerous usage is.
                 * log format: entryType, iid, scope, name, objId
                 * objId = -1: primitive variable; objId > 0: object value
                 */
                record = accessBuilder.push({
                    name: metadata[3],
                    val: metadata[4],
                    entryType: "READ",
                    e: builder.getCurrentEvent(),
                    lineno: lineno,
                    iid: metadata[1],
                    location: that.locationManager.query(metadata[1]),
                });
            } else if (entryType == LogEntryType['PUTFIELD']) {
                //property write
                //log format: entryType, iid, base, propName, val,
                //identify the DELETE_PROP operation
                if (metadata[4] == 0) {
                    record = accessBuilder.push({
                        name: metadata[2],
                        prop: metadata[3],
                        val: metadata[4],
                        entryType: "DELETE_FIELD",
                        e: builder.getCurrentEvent(),
                        lineno: lineno,
                        iid: metadata[1],
                        location: that.locationManager.query(metadata[1]),
                    });
                } else {
                    record = accessBuilder.push({
                        name: metadata[2],
                        prop: metadata[3],
                        val: metadata[4],
                        entryType: "PUTFIELD",
                        e: builder.getCurrentEvent(),
                        lineno: lineno,
                        iid: metadata[1],
                        location: that.locationManager.query(metadata[1]),
                    });
                }
            } else if (entryType == LogEntryType['GETFIELD']) {
                //property read
                //TODO: if GETFIELD of an object is an object, I also consider it as a object use
                //log format: entryType, iid, base, propName, val
                record = accessBuilder.push({
                    name: metadata[2],
                    prop: metadata[3],
                    val: metadata[4],
                    entryType: "PUTFIELD",
                    e: builder.getCurrentEvent(),
                    lineno: lineno,
                    iid: metadata[1],
                    location: that.locationManager.query(metadata[1]),
                });
            } else if (entryType == LogEntryType['INVOKE_FUN']) {
                /**
                 * log format: entryType, iid, fName, args
                 * If fName is empty, invoking a fs related api, then use READ to locate callee function
                 * Else, use fName in INVOKE_FUN to locate callee function
                 * In a word, we use the location of callee function, where the event is registered,
                 * as the location of event
                 * TODO: is it problem?
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
            } //---------------------------------------------------------------------------------------------
              // Event
              //---------------------------------------------------------------------------------------------
            else if (entryType == LogEntryType['ASYNC_INIT']) {
                //log format: entryType, asyncId, type, prior
                builder.push({
                    id: metadata[1],
                    prior: computePrior(metadata),
                    type: metadata[2],
                    lineno: lineno,
                    entryType: 'ASYNC_INIT',
                    registerOp: {
                        //event: metadata[3],
                        event: computePrior(metadata),
                        lineno: lineno,
                    },
                    executionTimes: 0,
                });
            } else if (entryType == LogEntryType['ASYNC_INIT_TIMER']) {
                //log format: entryType, asyncId, type, prior, delayTime
                builder.push({
                    id: metadata[1],
                    prior: computePrior(metadata),
                    type: metadata[2],
                    delayTime: Number.parseInt(metadata[4]),
                    lineno: lineno,
                    entryType: 'ASYNC_INIT_TIMER',
                    registerOp: {
                        //event: metadata[3],
                        event: computePrior(metadata),
                        lineno: lineno,
                    },
                    executionTimes: 0,
                });
            } else if (entryType == LogEntryType['ASYNC_BEFORE']) {
                //log format: entryType, asyncId
                builder.enter(metadata[1], lineno);
                builder.startExecution(metadata[1], lineno);
                //It is possible that events of type TIMEOUT
                //registered once and executed multiple times
            } else if (entryType == LogEntryType['ASYNC_AFTER']) {
                //log format: entryType, asyncId
                builder.exit(metadata[1]);
            } else if (entryType == LogEntryType['ASYNC_PROMISERESOLVE']) {
                //log format: entryType, asyncId, eid, trigger
                builder.resolve(metadata[1], metadata[2], metadata[3], lineno);
            } else if (entryType == LogEntryType['PROMISE_ALL_BEGIN']) {
                //log format: entryType, current, trigger
                builder.promiseAllBegin();
            } else if (entryType == LogEntryType['PROMISE_ALL_END']) {
                //log format: entryType, current, trigger
                builder.promiseAllEnd();
            } else if (entryType == LogEntryType['PROMISE_RACE_BEGIN']) {
                //log format: entryType, current, trigger
                builder.promiseRaceBegin();
            } else if (entryType == LogEntryType['PROMISE_RACE_END']) {
                //log format: entryType, current, trigger
                builder.promiseRaceEnd();
            }
        }

        if (entryType == LogEntryType['READ'] || entryType == LogEntryType['WRITE'] || entryType == LogEntryType['PUTFIELD'] || entryType == LogEntryType['GETFIELD']) {
            builder.setELoc(record);
        }

        //all records are parsed. build happens-before graph for events. detect
        if (last) {
            logger.info('End parsing.');
            //console.log(builder.toString());
            var asyncObjects = builder.extract();
            var eLoc = builder.getELoc();
            var records = accessBuilder.extract();
            //Store events and records into files.
            var g = buildHBGraph({
                asyncObjects: asyncObjects,
                promiseAllSet: builder.getPromiseAllSet(),
                promiseRaceSet: builder.getPromiseRaceSet(),
                file: traceFile,
                image: true,
            });
            var hbFileName = g.hbFileName;
            var relations = g.relations;
            accessBuilder.store(hbFileName);
            //Invoke detector
            let results = {
                asyncObjects: asyncObjects,
                records: records,
                hbGraph: relations,
                eLoc: eLoc,
            }
            //console.log(builder.eLoc);
            cb(results);
        }
    };

    function computePrior (metadata) {
        var candidates = builder.getAll().filter(e => {return e.id == metadata[3];});
        if (candidates.length === 0){
            return metadata[3];
        }
        let current = builder.getCurrentEvent();
        //3 cases:
        //1. the normal case;
        //2. an event is registered by the event that execute multiple
        //   times
        //3. an PROMISE event is registered by another event b during
        //   the execution of event a
        if (current == metadata[3]) {
            return current;
        } else if (current.indexOf('-') == -1) {
            return metadata[3];
        } else {
            return current;
        }
    }
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

exports.TraceParser = TraceParser;