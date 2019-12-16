var graphviz = require('graphviz'),
    path = require('path'),
    fs = require('fs');

var exports = module.exports = {};

exports.drawGraph = function (hbGraph, outputFileName, warningNodes) {
    /** Create the digraph */
    var vGraph = graphviz.digraph('Happens-Before-Graph'),
        //allNodes = {};
        eventNodes = {},
        fileIONodes = {},
        vistaulEventNodes = {;
    
    /** Create nodes for digraph */
    /** Process eventNodes */
    for (var i = 0; i < hbGraph.eventNodes.length; i++) {
        var event = hbGraph.eventNodes[i],
            node = vGraph.addNode(event.id, {
                'color': common.COLOR.GREY,
                'style': common.STYLE,
                'shape': common.SHAPE.CIRCLE,
                'font': 'helvetica',
            });
        eventNodes[node.id] = node;
    }

    /** Process IONodes */
    Object.keys(hbGraph.fileIONodes).forEach(function (lineno) {
        var rcd = hbGraph.fileIONodes[lineno];
        if (rcd.isAsync) {
            var node = vGraph.addNode(rcd.lineno, {
                'color': common.COLOR.RED,
                'style': common.STYLE,
                'shape': common.SHAPE.CIRCLE,
                'font': 'helvetica',
            });
            fileIONodes[node.id] = node;
        }
    });

    /** Process visual event nodes */

    /** Create edges for digraph */
    for (var j = 0; j < hbGraph.eventNodes.length; j++) {
        var event = hbGraph.eventNodes[i];
        if (!event.hasOwnProperty('edges')) continue;
        var edges = event.edges;
        Object.keys(edges).forEach(function (edgeType) {
            if (edgeType == 'Register2Trigger') {
                Object.keys(edges[edgeType]).forEach(function (nextEventId) {
                    var vEdge = vGraph.addEdge(eventNodes[event.id],)
                })
            }
        })
    }

    /** Create warning nodes as additional nodes for digraph */


    /** Path of output file */

};