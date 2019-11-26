function Event (lineno, asyncId, prior, resourceType) {
    /**
     * lineno is the line number where event is registered
     * we utilize lineno to associate jalangi trace with async_hooks trace
     * in order to locate event in source code
     */
    this.lineno = lineno
    this.id = asyncId;
    this.prior = prior;
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
};

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
};

Event.prototype.isIntermediateEvent = function () {
    return this.memOperations.length == 0 && event.prior != undefined &&  event.hasOwnProperty('follower');
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
    /**
     * record the event registration order
     */
    this.eventRegisterOrder = new Array();
};

/**
 * @param {Event} event
 * 1. add event into this.events
 * 2. add follower attribute to its prior event
 * 3. update eventRegisterOrder
 */
EventManager.prototype.addEvent = function (event) {
    /** step 1. add event into this.events */
    if(this.events.hasOwnProperty(event.id)) {
        logger.error('There already has been an event with id' + event.id);
    } else {
        this.events[event.id] = event;
    }
    /**step 2. add follower attribute to its prior event */
    var prior = this.events[event.prior];
    this.events[prior].follower = event.id;
    /** step 3. update eventRegisterOrder */
    this.eventRegisterOrder.push(event.id);
};

/**
 * return the last registered event
 */
EventManager.prototype.lastEvent = function () {
    var id = this.eventRegisterOrder[this.eventRegisterOrder.length - 1];
    return this.events[id];
}

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
EventManager.prototype.addObjRcd = function (objRcd) {
    if (!this.event2objRcds.hasOwnProperty(objRcd.eid)) {
        this.event2objRcds[objRcd.eid] = new Array();
    };
    this.event2objRcds[objRcd.eid].push(objRcd.lineno);
};

/**
 * wrap events in this.events
 * events in this.events are all registered events,
 * some of them have registeredByAPI and location attribute
 * target:
 * 1. delete it in this.event2objRcds
 * 2. delete it in this.events: associate its prior with its follower event
 */
EventManager.prototype.wrapEvent = function () {
    for (var i = 0; i < this.events.length; i++) {  
        var e = this.events[i];
        //check if current event is the root event
        if (e.prior != undefined) {
            //check whether current event is the intermediate event
            if (e.isIntermediateEvent()) {
                /** step 1. delete it in this.event2objRcds */
                delete this.event2objRcds[e.id]
                /** step 2. delete it in this.events: associate its prior with its follower event */
                var priorId = e.prior,
                    followerId = e.follower;
                this.events[followerId].prior = priorId;
                this.events[priorId].follower = followerId;
                delete this.events[e.id];
            }
        }
    }
};

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

module.exports = {
    Event: Event,
    EventManager: EventManager
};