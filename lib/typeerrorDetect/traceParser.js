var logger = require('../../driver/logger.js').logger,
    LogEntryType = require('../analysis/LogEntryType.js'),
    lineReader = require('line-reader');

function TraceParser () {};
TraceParser.prototype.parse = function (traceFile, cb){
    //in case cb is undefined
    cb = cb || function () {};
    logger.info('Begin parsing trace', (typeof traceFile == 'string' && traceFile.endsWith('.log')) ? traceFile : '');

    var lineno = 0,
        record;

    this.happensBeforeGraph = new HappensBeforeGraph();

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
            
            if (entryType == LogEntryType['CREATE_OBJ']) {
                //object allocation format: entryType (metadata[0]), iid (metadata[1]), ObjId (metadata[2])
                record = new ObjectRecord(lineno,metadata[2], entryTypeName, metadata[1]);
                //TODO: add more metadata for 'CREATE_OBJ' in TraceCollection
            } else if (entryType == LogEntryType['READ']) {
                //object use
                //TODO: sort of strange
            } else if (entryType == LogEntryType['PUTFIELD']) {
                //property write
            } else if (entryType == LogEntryType['GETFIELD']) {
                //property read
            } else if (entryType == LogEntryType['ASYNC_INIT']) {
                
            } else if (entryType == LogEntryType['ASYNC_BEFORE']) {

            } else if (entryType == LogEntryType['ASYNC_AFTER']) {

            } else if (entryType == LogEntryType['ASYNC_PROMISERESOLVE']) {

            }
        }
        //associate object accessing record with event
        if (typeof(record) == 'object' && record instanceof ObjectRecord) {

        }
        //all records are parsed. build happens-before graph for events. detect
        if (last) {
            logger.info('End parsing.');
            this.happensBeforeGraph.ready();
            cb();
        }
    };

    var eventsManager = {
        /**
         * to hold all events, index by its asyncId, e.g., 
         * events[i] = e means the asyncId of e is i.
         */
        events = {}
    };
};

/******************************/
/*********Data Structure*******/
/******************************/

/**
 * 
 * @param {Number} lineno 
 * @param {String} objId 
 * @param {String} accessType
 * @param {String} iid
 * Represent an object accessing record.
 * accessType can be:
 * createObj, useObj, propWrite, propRead
 * Note, identifier of ObjectRecord is lineno.
 */

function ObjectRecord (lineno, objId, accessType, iid) {
    this.lineno = lineno;
    this.objId = objId;
    this.accessType = accessType;
    this.iid = iid;
};

function ObjectManager () {
    /**
     * the array to hold all objects, indexed by its objId, e.g., 
     * objects[i] = o means the objId of object o is i.
     */
    this.objects = new Array();
    /**
     * the dictionary to hold all ObjectRecord, indexed by its identifier lineno
     */
    this.records = {};
    /**
     * the dictionary to hold all ObjectRecord of an object
     */
    this.obj2rcds = {};
};

function Event (asyncId, prior, resourceType) {
    this.id = asyncId;
    this.prior = prior;
    this.priority = resourceType2priority(resourceType);
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

function PointToManager () {
    this.map = {};
};

PointToManager.prototype.set = function () {};

function HappensBeforeGraph () {
    this.nodes = {};
    this.edges = {};
}

HappensBeforeGraph.prototype.ready = function () {
    logger.info('start to build happens-before graph ...');
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