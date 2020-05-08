var logger = require('../../driver/logger.js').logger,
    LogEntryType = require('../analysis/LogEntryType.js'),
    lineReader = require('line-reader');

/**
 * Different script will create a new object in trace 
 * Currently, I ignore OBJECT_CREATE caused by different script when debugging
 * Bug: first create a new object, then SOURCE_MAPPING, then read/write execution
 * record.accessType == 'CREATE_OBJ' && record.iid == '-1'
*/

//import data structure
var LocationManager = require('./LocationManager');

/** This structure is to extract events from the trace */
var AsyncObjectsBuilder = require('./AsyncObjectsBuilder'),
    builder = new AsyncObjectsBuilder();
var buildHBGraph = require('./hb/_index');
const AccessBuilder = require('./AccessBuilder'),
    accessBuilder = new AccessBuilder();
const FunctionBuilder = require('./FunctionBuilder'),
    functionBuilder = new FunctionBuilder();

/** this variable is used to debug. true is to debug*/
var debug = false;
var debugHelper = require('./debug').debugHelper,
    print_array = require('./debug').print_array,
    writeObj = require('./debug').writeObj;

function TraceParser () {
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
            } else if (entryType == LogEntryType['SCRIPT_EXIT']) {
                //log format: entryType, iid
                //that.locationManager.scriptExit();
                
            } else if (entryType == LogEntryType['CREATE_OBJ']) {
                //object allocation format: entryType (metadata[0]), iid (metadata[1]), ObjId (metadata[2])
                
                
                //TODO: add more metadata for 'CREATE_OBJ' in TraceCollection
            } else if (entryType == LogEntryType['CREATE_FUN']) {
                /**
                 * log format: entryType, iid, functionEnterIid, objId, name
                 * Two target: 1. create obj; 2. localize function
                 */
                
            } else if (entryType == LogEntryType['WRITE']) {
                //log format: entryType, iid, scope, name, objId
                record = accessBuilder.push({
                    name: metadata[3],
                    val: metadata[4], //TODO
                    entryType: "WRITE",
                    event: builder.getCurrentEvent(),
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
                    event: builder.getCurrentEvent(),
                    lineno: lineno,
                    iid: metadata[1],
                    location: that.locationManager.query(metadata[1]),
                });
            } else if (entryType == LogEntryType['PUTFIELD']) {
                //property write
                //log format: entryType, iid, base, propName, val,
                record = accessBuilder.push({
                    name: metadata[2],
                    prop: metadata[3],
                    val: metadata[4],
                    entryType: "PUTFIELD",
                    event: builder.getCurrentEvent(),
                    lineno: lineno,
                    iid: metadata[1],
                    location: that.locationManager.query(metadata[1]),
                });
            } else if (entryType == LogEntryType['GETFIELD']) {
                //property read
                //TODO: if GETFIELD of an object is an object, I also consider it as a object use
                //log format: entryType, iid, base, propName, val
                record = accessBuilder.push({
                    name: metadata[2],
                    prop: metadata[3],
                    val: metadata[4],
                    entryType: "GETFIELD",
                    event: builder.getCurrentEvent(),
                    lineno: lineno,
                    iid: metadata[1],
                    location: that.locationManager.query(metadata[1]),
                });
            } else if (entryType == LogEntryType["DELETE"]) {
                //log format: entryType, iid, base, propName
                record = accessBuilder.push({
                    name: metadata[2],
                    prop: metadata[3],
                    entryType: "DELETE",
                    event: builder.getCurrentEvent(),
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
                //Change log format: entryType, iid, funName, eid (current)
                builder.associateCallbacks(metadata[2], metadata[3], lineno, that.locationManager.query(metadata[1]));
                //use the function builder to identify isDeclaredLocal
                functionBuilder.enter(metadata[1]);
            } else if (entryType == LogEntryType['DECLARE']) {
                //log format: entryType, iid, scope,name, val
                
                record = accessBuilder.push({
                    name: metadata[3],
                    val: metadata[4],
                    entryType: 'DECLARE',
                    event: builder.getCurrentEvent(),
                    lineno: lineno,
                    iid: metadata[1],
                    location: that.locationManager.query(metadata[1]),
                });
                //use the function builder to identify isDeclaredLocal
                functionBuilder.declare(record.name);
            } else if (entryType == LogEntryType['RETURN']) {
                //log format: entryType, iid, val
                
            } else if (entryType == LogEntryType['FUNCTION_EXIT']) {
                //log format: entryType, iid
                //use the function builder to identify isDeclaredLocal
                functionBuilder.exit();
                
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

        if (entryType == LogEntryType['READ'] || entryType == LogEntryType['WRITE'] || entryType == LogEntryType['PUTFIELD'] || entryType == LogEntryType['GETFIELD'] || entryType == LogEntryType['DECLARE']) {
            builder.setELoc(record);
            if (functionBuilder.isDeclaredLocal(record.name)){
                record.isDeclaredLocal = true;
            }
        }

        //all records are parsed. build happens-before graph for events. detect
        if (last) {
            logger.info('End parsing.');
            //console.log(builder.toString());
            builder.ready();
            accessBuilder.ready(builder.getELocs());
            var asyncObjects = builder.extract();
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
            logger.info('Length of events: %d', asyncObjects.getAll().length);
            let results = {
                asyncObjects: asyncObjects,
                records: records,
                hbGraph: relations,
                rg: g.rg,
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

exports.TraceParser = TraceParser;