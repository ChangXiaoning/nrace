var graphviz = require('graphviz'),
    path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    logger = require('../../../../driver/logger.js').logger,
    EdgeName2Type = require('../../HappensBeforeGraph').EdgeName2Type;

/** Configuration for graphViz */
var common = require('../../../../test/common');
var graphVizDir = common.TOOL_HOME + path.sep + 'test/output-graphviz';

/** this variable is used to debug. true is to debug*/
var debug = false;
var debugHelper = require('../../debug').debugHelper,
    print_array = require('../../debug').print_array,
    writeObj = require('../../debug').writeObj;

var exports = module.exports = {};

exports.drawGraph = function (hbGraph, outputFileName, warningNodes) {
    logger.info('start to draw vGraph ...');
    console.log('graphVizDir: ', graphVizDir);
    
};