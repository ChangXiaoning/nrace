var logger = require('../../driver/logger.js').logger;

function HappensBeforeGraph () {
    this.nodes = {};
    this.edges = {};
}

HappensBeforeGraph.prototype.ready = function () {
    logger.info('start to build happens-before graph ...');
};

module.exports = HappensBeforeGraph;