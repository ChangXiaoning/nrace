var logger = require('../../driver/logger.js').logger;

function HappensBeforeGraph () {
    this.eventNodes = new Array();
    this.fileIONodes = {};
    this.edges = {};
}

/**
 * @param {Array} events
 * @param {Object} fileIOs
 */
HappensBeforeGraph.prototype.ready = function (events, fileIOs) {
    logger.info('start to build happens-before graph ...');
    this.eventNodes = events;
    this.fileIONodes = fileIOs;
};



module.exports = HappensBeforeGraph;