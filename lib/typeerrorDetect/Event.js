var logger = require('../../driver/logger.js').logger;

/** this variable is used to debug. true is to debug*/
var debug = false;
var debugHelper = require('./debug').debugHelper,
    print_array = require('./debug').print_array,
    writeObj = require('./debug').writeObj;

function Event (lineno, asyncId, prior, resourceType) {
    /**
     * lineno is the line number where event is registered
     * we utilize lineno to associate jalangi trace with async_hooks trace
     * in order to locate event in source code
     */
    this.lineno = lineno
    this.id = asyncId;
    this.prior = prior;
    this.resourceType = resourceType;
    this.priority = resourceType2priority(resourceType);
    /**
     * When the event is reigstered, its registerByAPI and location attribute is undefined
     * We will use INVOKE_FUN or READ operation to find its registerByAPI,
     * and use registerByAPI to find its location
     */
    this.registerByAPI = undefined;
    this.location = undefined;
    /**
     * all object operations performed by event
     * aim: to identify intermediate event for event wrapping
     * this.memOperations.push(lineno)
     */
    this.memOperations = new Array();
    /**
     * Save all operations, including ObjectRecord (i.e., memOperations),
     * event registration and triggering operations
     * All elements are lineno or 'T' + lineno (String for trigger operation)
     */
    this.operations = new Array();
};

/**
 * Model the global script as a big event,
 * whose asyncId is 1
 * The asyncId for global event is not randomly selected
 * It is because the async_hooks assign id #1 to the global event without registration
 */
Event.GLOBAL_EVENT = '1';
Event.GLOBAL_PRIOR = '-2';
Event.GLOBAL_RESOURCETYPE = 'GLOBAL';
Event.UNKNOW_EVENT = '-3';
Event.UNKNOW_RESOURCETYPE = 'UNKNOWN';

/**
 * @param {String} fName
 */
Event.prototype.addRegisterByAPI = function (fName) {
    this.registerByAPI = fName;
};

/**
 * @param {String} location
 */
Event.prototype.addLocation = function (location) {
    this.location = location;
};

Event.prototype.addMemOp = function (lineno) {
    this.memOperations.push(lineno);
    this.addOp(lineno);
};

Event.prototype.addOp = function (lineno) {
    this.operations.push(lineno);
};

function EventManager () {
    /**
     * hold all events, indexed by asyncId, e.g., 
     * events[asyncId] = e <Event>
     */
    this.events = new Array();
    /**
     * hold all unknown events
     * Not indexed by id, just push into this data structure as a stack
     */
    this.unknowEvents = new Array();
    /**
     * hold all ObjectRecord performed by this event, e.g., 
     * event2objRcds[asyncId] = [lineno] <Array>
     */
    this.event2objRcds = {};
    /**
     * model the call stack, to trace the current event
     */
    this.stack = new Array ();
    /**
     * record the event registration order
     */
    this.eventRegisterOrder = new Array();
    /**
     * hold all EventOperation instance
     * this.eventOperations[lineno] = op <EventOperation>
     */
    this.eventOperations = {};
};

/**
 * @param {Event} event
 * 1. add event into this.events
 * 2. add follower attribute to its prior event
 * 3. update eventRegisterOrder
 */
EventManager.prototype.addEvent = function (event) {
    debug = false;
    if (debug) {
        debugHelper('Before add event #' + event.id);
        debugHelper('event:');
        debugHelper(event);
        debugHelper('this.events');
        debugHelper(this.events);
    }
    /** step 1. add event into this.events */
    if(this.events.hasOwnProperty(event.id)) {
        logger.error('There already has been an event with id ' + event.id);
    } else {
        this.events[event.id] = event;
    }
    /**
     * step 2. add follower attribute to its prior event
     * In case of the global event, whose prior does not exist 
     */
    //if (event.id != Event.GLOBAL_EVENT) {
        var prior = this.events[event.prior];
        /** Strange: some prior does not be registered before */
        if (!prior) {
            //TODO
            prior = new Event(event.lineno, event.prior, Event.UNKNOW_EVENT, Event.UNKNOW_RESOURCETYPE);
            this.unknowEvents.push(prior);
        }
        prior.follower = prior.follower? prior.follower : new Array();
        prior.follower.push(event.id);
    //}
    /** step 3. update eventRegisterOrder */
    this.eventRegisterOrder.push(event.id);
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
    if (this.top() != id) {
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
    return this.stack[this.stack.length - 1];
}

/**
 * @param {ObjectRecord} objRcd
 * add ObjectRecord into this.event2objRcds
 */
EventManager.prototype.addObjRcd = function (objRcd) {
    if (!this.event2objRcds.hasOwnProperty(objRcd.eid)) {
        this.event2objRcds[objRcd.eid] = new Array();
    };
    this.event2objRcds[objRcd.eid].push(objRcd.lineno);
};

/**
 * @param {EventOperation} eventOp
 * 1. save eventOp into this.eventOperations
 * 2. save eventOp into the event instance
 *    For 2nd step: if eventOp is a trigger operation, eventOp is put
 *    into event queue according to eventOp.eventType. For nextTick
 *    and Immediate type, eventOp is directly put into event instance.
 *    For other types, do not save into event instance.
 */
EventManager.prototype.addEventOperation = function (eventOp) {
    this.eventOperations[eventOp.id] = eventOp;
    var event = this.events[eventOp.prior];
    /**
     * Strange: some prior does not be registered before
     * We have save this kind of events into this.unknowEvents using method addEvent()
     */
    if (event != undefined) {
        if (eventOp.type == 'register' || eventOp.type == 'trigger' && eventOp.eventType == 'TickObject' || eventOp.eventType == 'Immediate')
            event.addOp(eventOp.id);
    }
};

/**
 * @param {String} targetEvent: asyncId of the target event
 * @returns {String}
 * A trick used here is that each internal callback for file IO request
 * only has one follower callback
 */
EventManager.prototype.wrapFileEvent = function (targetEvent) {
    var targetE = this.events[targetEvent];
    debug = false;
    if (debug) {
        debugHelper('1. targetEvent:' + targetEvent);
        writeObj(targetE);
    }
    if (targetE.resourceType != 'FSREQWRAP' || !targetE.hasOwnProperty('follower')) return;
    while (targetE.memOperations.length == 0) {
        targetEvent = targetE.follower[0];
        targetE = this.events[targetEvent];
        if (debug) {
            debugHelper('2. targetEvent:' + targetEvent);
            writeObj(targetE);
        }
    }
    if (debug) {
        debugHelper('result of wrapFileEvent is #' + targetEvent);
        debugHelper('type targetEvent:' + typeof(targetEvent));
    }
    return targetEvent;
};

/**
 * FSEVENTWRAP, FSREQWRAP, GETADDRINFOREQWRAP, GETNAMEINFOREQWRAP, HTTPPARSER,
 * JSSTREAM, PIPECONNECTWRAP, PIPEWRAP, PROCESSWRAP, QUERYWRAP, SHUTDOWNWRAP,
 * SIGNALWRAP, STATWATCHER, TCPCONNECTWRAP, TCPWRAP, TIMERWRAP, TTYWRAP,
 * UDPSENDWRAP, UDPWRAP, WRITEWRAP, ZLIB, SSLCONNECTION, PBKDF2REQUEST,
 * RANDOMBYTESREQUEST, TLSWRAP, Timeout, Immediate, TickObject
 * TickObject: 1, Timeout: 2, Immediate: 2, Other: 3
 * TODO: two custom types: GLOBAL, UNKNOW
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

/** 
 * Event registration & triggering operation class definition
 * @param {String} type: can be 'register', 'trigger', 'promise'
 * @param {Number|String} id: lineno (Number, for register operation)
 * or 'T' + lineno (String, for trigger operation)
 * @param {String} prior
 * @param {String} follower
 * @param {String} eventType: Immediate etc. The type of event, which
 * is registered or triggered.
 */
function EventOperation (type, id, prior, follower, eventType) {
    this.type = type;
    this.id = id;
    this.prior = prior;
    this.follower = follower;
    this.eventType = eventType;
};

/**
 * @param {String} edgeType
 * @param {String} nextOpId
 */
EventOperation.prototype.addEdge = function (edgeType, nextOpId) {
    if (!this.hasOwnProperty('edges')) this.edges = {};
    if (!this.edges.hasOwnProperty(edgeType)) this.edges[edgeType] = new Array();
    this.edges[edgeType].push(nextOpId);
};

module.exports = {
    Event: Event,
    EventManager: EventManager,
    EventOperation: EventOperation
};