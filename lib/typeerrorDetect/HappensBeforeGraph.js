function HappensBeforeGraph () {
    this.operations
    this.triggerOperations
    this.events
};

HappensBeforeGraph.prototype.ready = function (events, operations, fileIOs) {
    this.nodesI = operations;
    this.nodesII = fileIOs;
    this.events = events;
};

HappensBeforeGraph.prototype.addProgramOrder = function () {
    
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