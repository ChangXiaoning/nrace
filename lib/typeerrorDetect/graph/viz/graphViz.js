var graphviz = require('graphviz'),
    path = require('path'),
    fs = require('fs');

var exports = module.exports = {};

exports.drawGraph = function (hbGraph, outputFileName, warningNodes) {
    /** Create the digraph */
    var vGraph = graphviz.digraph('Happens-Before-Graph'),
        allNodes = {};
    
    /** Create nodes for digraph */
    for (var i = 0; i < hbGraph.nodes.length; i++) {

    }

    /** Create edges for digraph */
    for (var j = 0; j < hbGraph.edges.length; j++) {

    }

    /** Create warning nodes as additional nodes for digraph */


    /** Path of output file */

};