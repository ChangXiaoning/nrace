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
const ActionManager = require('./ActionManager'),
    actionManager = new ActionManager();

/** this variable is used to debug. true is to debug*/
var debug = false;
var debugHelper = require('./debug').debugHelper,
    print_array = require('./debug').print_array,
    writeObj = require('./debug').writeObj;

const Prefix = '*U*';
const Action_Prefix = '*A*';

//iid -> names
var fvMap = new Map ();
const FreeVariables_ANY = 'ANY';

function TraceParser () {
    this.locationManager = new LocationManager();
};

TraceParser.prototype.parse = function (traceFile, isbuildGraph, cb){
    //in case cb is undefined
    cb = cb || function () {};
    logger.info('Begin parsing trace', (typeof traceFile == 'string' && traceFile.endsWith('.log')) ? traceFile : '');

    var lineno = 0,
        that = this,
        record,
        action,
        event;
    
    var FileAccessTypes = {
        'FS_WRITE': 'W',
        'FS_READ': 'R',
        'FS_DELETE': 'D',
        'FS_OPEN': 'O',
        'FS_CLOSE': 'X',
        'FS_CREATE': 'C',
        'FS_STAT': 'S'
    };

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
        action = null;
        event = null;
        
        /** debug */
        if (debug) {
            debugHelper('===============' + lineno);
            debugHelper(line);
        }
        if (lineno <= 14075)
        //console.log('Parser:'+ lineno);

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
                functionBuilder.scriptEnter(metadata[1]);

                record = accessBuilder.push({
                    entryType: 'SCRIPT_ENTER',
                    iid: metadata[1],
                    scriptId: metadata[2],
                    filename: metadata[3],
                    lineno: lineno,
                });
            } else if (entryType == LogEntryType['SCRIPT_EXIT']) {
                //log format: entryType, iid
                //that.locationManager.scriptExit();
                functionBuilder.scriptExit();

                record = accessBuilder.push({
                    entryType: 'SCRIPT_EXIT',
                    iid: metadata[1],
                    lineno: lineno,
                });
            } else if (entryType == LogEntryType['CREATE_OBJ']) {
                //object allocation format: entryType (metadata[0]),
                //iid (metadata[1]), ObjId (metadata[2]), name
                //(metadata[3])
                let name = metadata[3];
                if (name != 'arguments')
                    record = accessBuilder.push({
                        name: name != 'undefined' ? name : 'return',
                        iid: metadata[1],
                        val: metadata[2],
                        entryType: "CREATE_OBJ",
                        event: builder.getCurrentEvent(),
                        lineno: lineno,
                        location: that.locationManager.query(metadata[1]),
                    });
                
            } else if (entryType == LogEntryType['CREATE_FUN']) {
                /**
                 * log format: entryType, iid, functionEnterIid, objId, name
                 * Two target: 1. create obj; 2. localize function
                 */
                functionBuilder.createFun(metadata[3]);
            } else if (entryType == LogEntryType['WRITE']) {
                //log format: entryType, iid, scope, name, objId, valIsObject
                record = accessBuilder.push({
                    ref: metadata[2],
                    name: metadata[3],
                    val: metadata[4],
                    valIsObject: metadata[5],
                    entryType: "WRITE",
                    event: builder.getCurrentEvent(),
                    lineno: lineno,
                    iid: metadata[1],
                    location: that.locationManager.query(metadata[1]),
                });
            } else if (entryType == LogEntryType['READ']) {
                /**
                 * TODO: object use: we need to monitor the operation after READ operation to determine what the dangerous usage is.
                 * log format: entryType, iid, scope, name, objId, valIsObject
                 * objId = -1: primitive variable; objId > 0: object value
                 */
                record = accessBuilder.push({
                    ref: metadata[2],
                    name: metadata[3],
                    val: metadata[4],
                    valIsObject: metadata[5],
                    entryType: "READ",
                    event: builder.getCurrentEvent(),
                    lineno: lineno,
                    iid: metadata[1],
                    location: that.locationManager.query(metadata[1]),
                });
            } else if (entryType == LogEntryType['PUTFIELD']) {
                //property write
                //log format: entryType, iid, base, propName, val, isOpAssign, valIsObject, isComputed
                record = accessBuilder.push({
                    name: metadata[2],
                    prop: metadata[3],
                    val: metadata[4],
                    isOpAssign: metadata[5],
                    valIsObject: metadata[6],
                    isComputed: metadata[7],
                    entryType: "PUTFIELD",
                    event: builder.getCurrentEvent(),
                    lineno: lineno,
                    iid: metadata[1],
                    location: that.locationManager.query(metadata[1]),
                });
            } else if (entryType == LogEntryType['GETFIELD']) {
                //property read
                //TODO: if GETFIELD of an object is an object, I also consider it as a object use
                //log format: entryType, iid, base, propName, val, valIsObject, isComputed
                record = accessBuilder.push({
                    name: metadata[2],
                    prop: metadata[3],
                    val: metadata[4],
                    valIsObject: metadata[5],
                    isComputed: metadata[6],
                    entryType: "GETFIELD",
                    event: builder.getCurrentEvent(),
                    lineno: lineno,
                    iid: metadata[1],
                    location: that.locationManager.query(metadata[1]),
                });
            } else if (entryType == LogEntryType["DELETE"]) {
                //log format: entryType, iid, base, propName
                //TODO: basename
                record = accessBuilder.push({
                    name: metadata[2],
                    prop: metadata[3],
                    entryType: "DELETE",
                    event: builder.getCurrentEvent(),
                    lineno: lineno,
                    iid: metadata[1],
                    location: that.locationManager.query(metadata[1]),
                    val: Prefix,
                    valIsObject: 'false',
                });
            } else if (entryType == LogEntryType["BINARY"]) {
                //log format: entryType, iid, op, left, right, result, isOpAssign
                record = accessBuilder.push({
                    entryType: "BINARY",
                    iid: metadata[1],
                    op: metadata[2],
                    left: metadata[3],
                    right: metadata[4],
                    result: metadata[5],
                    event: builder.getCurrentEvent(),
                    lineno: lineno,
                    location: that.locationManager.query(metadata[1]),
                })
            } else if (entryType == LogEntryType['INVOKE_FUN']) {
                /**
                 * log format: entryType, iid, fName, args
                 * If fName is empty, invoking a fs related api, then use READ to locate callee function
                 * Else, use fName in INVOKE_FUN to locate callee function
                 * In a word, we use the location of callee function, where the event is registered,
                 * as the location of event
                 * TODO: is it problem?
                 */
            } else if (entryType == LogEntryType['FUNCTION_ARG']) {
                //log format: entryType, iid, funId
                functionBuilder.createFun(metadata[2]);
            } else if (entryType == LogEntryType['FUNCTION_ENTER']) {
                //log format: entryType, iid, funName
                //Change log format: entryType, iid, funName, eid (current), funId
                builder.associateCallbacks(metadata[2], metadata[3], lineno, that.locationManager.query(metadata[1]));
                //use the function builder to identify isDeclaredLocal
                //functionBuilder.enter(metadata[1]);
                var referencedByClosure = fvMap.get(metadata[1]);
                functionBuilder.functionEnter(metadata[4], metadata[1], referencedByClosure, lineno);
                
                record = accessBuilder.push({
                    entryType: 'FUNCTION_ENTER',
                    iid: metadata[1],
                    funName: metadata[2],
                    eid: metadata[3],
                    funId: metadata[4],
                    lineno: lineno,
                });
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
                functionBuilder.declare(record.name, record.val);
            } else if (entryType == LogEntryType['RETURN']) {
                //log format: entryType, iid, val
                
            } else if (entryType == LogEntryType['FUNCTION_EXIT']) {
                //log format: entryType, iid
                //use the function builder to identify isDeclaredLocal
                //functionBuilder.exit();
                functionBuilder.functionExit(lineno);

                record = accessBuilder.push({
                    entryType: 'FUNCTION_EXIT',
                    iid: metadata[1],
                    lineno: lineno,
                })
            } else if (entryType == LogEntryType['FREE_VARS']) {
                //log format: entryType, iid, len, name(s)
                var iid =  metadata[1];
                var len = parseInt(metadata[2]);
                var name = null;
                if (len == -1) {
                    name = FreeVariables_ANY;
                    fvMap.set(iid, name);
                } else {
                    name = new Set();
                    for (let i = 0; i < len; i++) {
                        name.add(metadata[3 + i]);
                    }
                    fvMap.set(iid, name);
                }
            } else if (entryType == LogEntryType["CONDITIONAL"]) {
                //log format: entryType, iid, result
                record = accessBuilder.push({
                    entryType: 'CONDITIONAL',
                    iid: metadata[1],
                    result: metadata[2],
                    event: builder.getCurrentEvent(),
                    lineno: lineno,
                    location: that.locationManager.query(metadata[1]),
                });
            }
            //----------------------------------------------------------
            //FILE SYSTEM MODEL
            //---------------------------------------------------------- 
            else if (FileAccessTypes[LogEntryType[entryType]]) {
                //log format: entryType, resource, funName, ref,
                //lastAsyncId, location, isAsync
                if (metadata[6] === '1') {
                    //async fs action
                    action = actionManager.push({
                        id: Action_Prefix + lineno,
                        entryType: FileAccessTypes[LogEntryType[entryType]],
                        resource: metadata[1],
                        funName: metadata[2],
                        event: builder.getCurrentEvent(),
                        callback: metadata[4],
                        lineno: lineno,
                        isAsync: metadata[6],
                    });
                } else {
                    record = accessBuilder.push({
                        entryType: FileAccessTypes[LogEntryType[entryType]],
                        resource: metadata[1],
                        funName: metadata[2],
                        event: builder.getCurrentEvent(),
                        lineno: lineno,
                        isAsync: metadata[6],
                    });
                }
            }
             //---------------------------------------------------------------------------------------------
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
            //bind scope
            record.ctx = functionBuilder.getCurrentContextEnterIid();
        }

        //deal with bug in isObject
        if (entryType == LogEntryType['READ'] || entryType == LogEntryType['WRITE'] || entryType == LogEntryType['PUTFIELD'] || entryType == LogEntryType['GETFIELD']) {
            if (record.valIsObject == 'undefined' || record.valIsObject == 'null')
                record.valIsObject = 'false';
        }

        //all records are parsed. build happens-before graph for events. detect
        if (last) {
            logger.info('End parsing.');
            //console.log(builder.toString());
            var var2scope = functionBuilder.ready();
            //console.log(var2scope);
            builder.ready();
            accessBuilder.ready(builder.getELocs());
            var asyncObjects = builder.extract();
            var records = accessBuilder.extract();
            records = actionManager.ready(records);
            //Store events and records into files.
            var g = buildHBGraph({
                asyncObjects: asyncObjects,
                promiseAllSet: builder.getPromiseAllSet(),
                promiseRaceSet: builder.getPromiseRaceSet(),
                file: traceFile,
                image: true,
                isbuildGraph: isbuildGraph,
                actions: actionManager.extract(),
            });
            var hbFileName = g.hbFileName;
            var relations = g.relations;
            accessBuilder.store(hbFileName);
            functionBuilder.store(hbFileName);
            actionManager.store(hbFileName);
            //Invoke detector
            logger.info('Length of events: %d', asyncObjects.getAll().length);
            //Check the number of TickObject events
            let tickCounter = 0;
            let tickWithCb = 0;
            let events = asyncObjects.getAll();
            let tickobjects = [];
            events.forEach(event => {
                if (event.type == 'TickObject') { tickCounter++; tickobjects.push(event.id);}
                if (event.callback) tickWithCb++;
            });
            console.log('The number of TickObject: %s (%s)', tickCounter, tickWithCb);
            console.log(tickobjects.join(', '));
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
        if (lineno == 3833)
            console.log('bug');
        var candidates = builder.getAll().filter(e => {return e.id == metadata[3];});
        if (candidates.length === 0){
            return metadata[3];
        }
        let current = builder.getCurrentEvent();
        //4 cases:
        //1. the normal case;
        //2. an event is registered by the event that execute multiple
        //   times
        //3. an PROMISE event is registered by another event b during
        //   the execution of event a
        //4. an PROMISE event is registered between two evnets, i.e., current == undefined
        if (current == metadata[3]) {
            return current;
        } else if (current == null || current.indexOf('-') == -1) {
            return metadata[3];
        } else {
            return current;
        }

        /*if (current == metadata[3] || current == null) {
            return metadata[3];
        } else {
            return current;
        }*/
    }
};

exports.TraceParser = TraceParser;