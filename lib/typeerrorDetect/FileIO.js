var logger = require('../../driver/logger.js').logger;

/** this variable is used to debug. true is to debug*/
var debug = false;
var debugHelper = require('./debug').debugHelper,
    print_array = require('./debug').print_array,
    writeObj = require('./debug').writeObj;

function FileIO (lineno, resource, type, isAsync, eid, lastAsync) {
    this.lineno = lineno;
    this.resource = resource;
    this.type = type;
    /** <Boolean> */
    this.isAsync = isAsync;
    /** Note: different function and importance for (a)synchronous file operation */
    this.eid = eid;
    this.lastAsync = lastAsync;
};

/**
 * @param {String} follower: the asyncId of the callback,
 * which is triggered to execution once the completion of the asynchronous IO
 */
FileIO.prototype.addFollower = function (follower) {
    if (this.hasOwnProperty()) {
        logger.error('FileIO: already exist follower cb!');
        return;
    }
    this.followerCb = follower;
};

FileIO.prototype.addEdge = function (edgeType, nextEventId) {
    if (!this.hasOwnProperty('edges')) {
        this.edges = {};
    }
    if (!this.edges.hasOwnProperty(edgeType)) {
        this.edges[edgeType] = new Array();
    }
    this.edges[edgeType].push(nextEventId);
};

function FileIOManager () {
    /**
     * hold all FileIO records, indexed by lineno
     * i.e., this.fileIOs[lineno] = fileIO <FileIO>
     */
    this.fileIOs = {};
};

/**
 * @param {FileIO} fileIO
 */
FileIOManager.prototype.addFileIO = function (fileIO) {
    this.fileIOs[fileIO.lineno] = fileIO;
};

module.exports = {
    FileIO: FileIO,
    FileIOManager: FileIOManager
};