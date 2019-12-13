var logger = require('../../driver/logger.js').logger;

var Event = require('./Event').Event,
    EventManager = require('./Event').EventManager;

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
    this.eventNodes.forEach(function (event) {
        /** skip the last event of file callback chain */
        if (event.resourceType != Event.GLOBAL_RESOURCETYPE || event.hasOwnProperty('prior') || !event.hasOwnProperty('triggerIO')) {
            var prior = this.eventNodes[event.prior],
                triggerId = this.virtualEvents.get(event.id).id;
            prior.addEdge(EdgeName2Type('Register2Trigger'), triggerId);
        }
    });
    /** process file record */
    Object.keys(this.fileIONodes).forEach(function (lineno) {
        var rcd = this.fileIONodes[lineno];
        if (rcd.isAsync) {
            var followCb = this.eventNodes[rcd.followCb],
                prior = this.eventNodes[followCb.prior];
            prior.addEdge(EdgeName2Type('Register2IO'), rcd.lineno);
        }
    });
};

/**
 * For each event,
 * add happens-before edge between its triggering event and itself
 */
HappensBeforeGraph.prototype.addTrigger2Cb = function () {
    this.eventNodes.forEach(function (event) {
        /** skip the last event of file callback chain */
        if (event.resourceType != Event.GLOBAL_RESOURCETYPE || !event.hasOwnProperty('triggerIO')) {
            var trigger = this.virtualEvents.get(event.id);
            trigger.addEdge(EdgeName2Type('Trigger2Follower'), event.id);
        }
    });
    Object.keys(this.fileIONodes).forEach(function (lineno) {
        var rcd = this.fileIONodes[lineno];
        if (rcd.isAsync) {
            rcd.addEdge(EdgeName2Type('IO2Follower'), rcd.followCb);
        }
    });
};

HappensBeforeGraph.prototype.addFIFO = function () {
    for (var i = 0; i < this.eventNodes.length - 1; i++) {
        var eventI = this.eventNodes[i];
        if (eventI.resourceType == Event.GLOBAL_EVENT) continue;
        var triggerI = this.virtualEvents.get(eventI.id),
            priorityI = eventI.priority;
        for (var j = i + 1; j < this.eventNodes.length; j++) {
            var eventJ = this.eventNodes[j];
            if (eventJ.resourceType == Event.GLOBAL_EVENT || eventJ.priority != priorityI) continue;
            var triggerJ = this.virtualEvents.get(eventJ.id);
            if (this.isHappensBefore(eventI.id, eventJ.id)) {
                eventI.addEdge(EdgeName2Type('FIFO'), eventJ.id);
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
    if (this.eventNodes[eventI] == undefined) {
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
            followers.push(event.edges[edgeType]);
        });
        if (followers.indexOf(eventJ) != -1) {
            this.hbCache.set([eventI, eventJ], true);
            return true;
        } else {
            for (var i = 0; i < followers.length; i++) {
                if (this.isHappensBefore(followers[i], eventJ)) {
                    this.hbCache([eventI, eventJ], true);
                    return true;
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

module.exports = HappensBeforeGraph;