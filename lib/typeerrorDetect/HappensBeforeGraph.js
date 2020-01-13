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
    this.operations
    this.triggerOperations
    this.events
};

HappensBeforeGraph.prototype.ready = function (events, operations, fileIOs) {
    logger.info('start to build happens-before graph ...');
    this.nodesI = operations;
    this.nodesII = fileIOs;
    this.events = events;

    /** Visualize this happens-before graph */
    graphViz.drawGraph(this, '00');
};

HappensBeforeGraph.prototype.addProgramOrder = function () {
    var that = this;
    this.events.forEach(function (event) {
        var operations = events.operations;
        var i = 0, j = 1;
        while (j < operations.length) {
            var opI = that.nodeI[operations[i]];
            opI.addEdge('program', operations[j]);
            i = j;
            j++;
        }
    });
};

HappensBeforeGraph.prototype.addReg2Trigger = function () {

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