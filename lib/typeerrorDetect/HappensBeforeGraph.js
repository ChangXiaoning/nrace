var logger = require('../../driver/logger.js').logger,
    path = require('path');

var Event = require('./Event').Event,
    EventManager = require('./Event').EventManager;

var graphViz = require('./graph/viz/graphViz');

/** this variable is used to debug. true is to debug*/
var debug = true;
var debugHelper = require('./debug').debugHelper,
    print_array = require('./debug').print_array,
    writeObj = require('./debug').writeObj;

function HappensBeforeGraph () {
    /*
    this.eventNodes = new Array();
    this.virtualEvents = new Map();
    this.fileIONodes = {};
    */
   this.edges = {};
   /**
    * hold previous hb check, e.g., 
    * this.hbCache([event1, event2], false)
    */
   this.hbCache = new Map();
}

/**
 * @param {Array} events
 * @param {Object} fileIOs
 */
HappensBeforeGraph.prototype.ready = function (events, virtualEvents, fileIOs) {
    logger.info('start to build happens-before graph ...');
    this.eventNodes = events;
    this.virtualEvents = virtualEvents;
    this.fileIONodes = fileIOs;
    /** Check initialized events for HBG */
    /*
    console.log('Check initialized events for HBG');
    var that = this;
    Object.keys(that.eventNodes).forEach(function (asyncId) {
        var e = that.eventNodes[asyncId];
        debugHelper('==========' + asyncId);
        //writeObj(e);
    });
    
    var that = this;
    for (var [id, event] of that.virtualEvents.entries()) {
        debugHelper('==========' + id);
        writeObj(event);
    }

    var that = this;
    console.log('HBG ready, fileIONodes:');
    debugHelper(that.fileIONodes);
    if (debug) {
        console.log('hello world');
        Object.keys(that.fileIONodes).forEach(function (lineno) {
            var rcd = that.fileIONodes[lineno];
            if (rcd.isAsync) {
                debugHelper('fileRcd:' + lineno);
                //writeObj(rcd);
            }
        });
    }*/
    this.addRegister2Trigger();
    this.addTrigger2Cb();
    this.addFIFO();

    /** Visualize this happens-before graph */
    graphViz.drawGraph(this, '00');
};

/**
 * For each event,
 * add happens-before edge between its prior and its triggering event
 * Specially:
 * For global event: not add edge;
 * For file IO, add edge between triggering event and IO
 */
HappensBeforeGraph.prototype.addRegister2Trigger = function () {
    //this.edge[EdgeName2Type('Register2Trigger')] = [];
    /** Test */
    debug = false;
    /*
    console.log('start of addRegister2Trigger');
    if (debug) {
        this.eventNodes.forEach(function (e) {
            debugHelper('==========' + e.id);
            writeObj(e);
        });
    }*/
    var that = this;
    
    this.eventNodes.forEach(function (event) {
        /** skip the last event of file callback chain */
        if (!event.hasOwnProperty('triggerIO')) {
            if (debug) {
                debugHelper('==========' + event.id);
                //writeObj(event);
                debugHelper(that.eventNodes[event.prior]);
            }
            /**
             * For the global event and events whose prior does not be registered before,
             * add edge???
             */
            var prior = that.eventNodes[event.prior];
            if (prior != undefined) {
                var triggerId = that.virtualEvents.get(event.id).id;
                prior.addEdge(EdgeName2Type('Register2Trigger'), triggerId);
            }
        }
    });
    /** process file record */
    //console.log('process file record:')
    var that = this;
    Object.keys(this.fileIONodes).forEach(function (lineno) {
        var rcd = that.fileIONodes[lineno];
        if (rcd.isAsync) {
            var followCb = that.eventNodes[rcd.followerCb],
                prior = that.eventNodes[followCb.prior];
            prior.addEdge(EdgeName2Type('Register2IO'), rcd.lineno);
            //console.log('add edge from #' + prior.id + ' to io' + lineno);
        }
    });
    debug = false;
    if (debug) {
        this.eventNodes.forEach(function (event) {
            debugHelper('#' + event.id);
            writeObj(event.edges);
        });
    }
};

/**
 * For each event,
 * add happens-before edge between its triggering event and itself
 */
HappensBeforeGraph.prototype.addTrigger2Cb = function () {
    var that = this;
    this.eventNodes.forEach(function (event) {
        /** skip the last event of file callback chain */
        //console.log('1. To create Trigger2Follower edge for #' + event.id);
        if (event.resourceType != Event.GLOBAL_RESOURCETYPE && !event.hasOwnProperty('triggerIO')) {
            var trigger = that.virtualEvents.get(event.id);
            trigger.addEdge(EdgeName2Type('Trigger2Follower'), event.id);
        }
    });
    Object.keys(this.fileIONodes).forEach(function (lineno) {
        var rcd = that.fileIONodes[lineno];
        if (rcd.isAsync) {
            rcd.addEdge(EdgeName2Type('IO2Follower'), rcd.followerCb);
        }
    });
};

HappensBeforeGraph.prototype.addFIFO = function () {
    for (var i = 0; i < this.eventNodes.length - 1; i++) {
        var eventI = this.eventNodes[i];
        if (!eventI || eventI.resourceType == Event.GLOBAL_EVENT) continue;
        var triggerI = this.virtualEvents.get(eventI.id),
            priorityI = eventI.priority;
        for (var j = i + 1; j < this.eventNodes.length; j++) {
            var eventJ = this.eventNodes[j];
            if (!eventJ || eventJ.resourceType == Event.GLOBAL_EVENT || eventJ.priority != priorityI) continue;
            var triggerJ = this.virtualEvents.get(eventJ.id);
            /** TODO: not add edge between two events on the same callback chain */
            if (this.isHappensBefore(eventI.id, eventJ.id)) {
                eventI.addEdge(EdgeName2Type('FIFO'), eventJ.id);
                logger.error('add FIFO edge from #' + eventI.id + ' to #' + eventJ.id);
            }
        }
    }
};

HappensBeforeGraph.prototype.addDiffPriority = function () {
    for (var i = 0; i < this.eventNodes.length - 1; i++) {
        var eventI = this.eventNodes[i];
        if (eventI.resourceType == Event.GLOBAL_EVENT) continue;
        var triggerI = this.virtualEvents.get(eventI.id),
            priorityI = eventI.priority;
        for (var j = i + 1; j < this.eventNodes.length; j++) {
            var eventJ = this.eventNodes[j];
            if (eventJ.resourceType == Event.GLOBAL_EVENT || priorityI >= eventJ.priority) continue;
            if (this.isHappensBefore(eventI.id, eventJ.id)) {
                eventI.addEdge(EdgeName2Type('DiffPriority'), eventJ.id);
            }
        }
    }
};

/**
 * check if eventI happens before eventJ
 * namely whether there is a directed path from eventI to eventJ
 * @param {String} eventI
 * @param {String} eventJ
 * @returns {Boolean}
 */
HappensBeforeGraph.prototype.isHappensBefore = function (eventI, eventJ) {
    if (!this.eventNodes[eventI] || !this.eventNodes[eventJ]) {
        logger.error('There not exist event #' + eventI);
        return;
    }
    var event = this.eventNodes[eventI];
    if (this.hbCache.has([eventI, eventJ])) {
        return this.hbCache.get([eventI, eventJ]);
    } else {
        if (!event.hasOwnProperty('edges')) {
            this.hbCache.set([eventI, eventJ], false);
            return false;
        }
        var followers = new Array();
        Object.keys(event.edges).forEach(function (edgeType) {
            //followers.push(event.edges[edgeType]);
            followers.push.apply(followers, event.edges[edgeType]);
        });
        if (followers.indexOf(eventJ) != -1) {
            this.hbCache.set([eventI, eventJ], true);
            return true;
        } else {
            for (var i = 0; i < followers.length; i++) {
                /** follower[i] can be an async file IO */
                if (followers[i] instanceof Event) {
                    if (this.isHappensBefore(followers[i], eventJ)) {
                        this.hbCache.set([eventI, eventJ], true);
                        return true;
                    }
                }
            }
            this.hbCache.set([eventI, eventJ], false);
            return false;
        }
        /*
        Object.keys(event.edges).forEach(function (edgeType) {
            event.edges[edgeType].forEach(function (nextEvent) {

            });
        });
        */
    }
};

/**
 * @param {String} typeName
 * @returns {Number}
 */
var EdgeName2Type = function (typeName) {
    switch (typeName) {
        case 'Register2Trigger':
            return 0;
        case 'Register2IO':
            return 1;
        case 'Trigger2Follower':
            return 2;
        case 'IO2Follower':
            return 3;
        case 'FIFO':
            return 4;
        case 'DiffPriority':
            return 5;
    }
};

/**
 * HappensBeforeGraph: used by TraceParser
 * EdgeName2Type: used by graphViz
 */
module.exports = {
    HappensBeforeGraph: HappensBeforeGraph,
    EdgeName2Type: EdgeName2Type
};