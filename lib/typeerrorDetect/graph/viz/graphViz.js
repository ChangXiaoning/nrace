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

    //console.log('****', EdgeName2Type);
    if (debug) {
        console.log('hello world');
        debugHelper(hbGraph.fileIONodes);
        Object.keys(hbGraph.fileIONodes).forEach(function (lineno) {
            hbGraph.fileIONodes
            var rcd = hbGraph.fileIONodes[lineno];
            if (rcd.isAsync) {
                debugHelper('fileRcd:' + lineno);
                //writeObj(rcd);
            }
        });
    }

    /** Create the digraph */
    var vGraph = graphviz.digraph('Happens-Before-Graph'),
        //allNodes = {};
        eventNodes = {},
        fileIONodes = {},
        virtualEventNodes = {};
    
    /** Create nodes for digraph */
    /** Process eventNodes */
    for (var i = 0; i < hbGraph.eventNodes.length; i++) {
        /** Note, eventNodes is a sparse array */
        var event = hbGraph.eventNodes[i];
        if (event != undefined) {
            var node = vGraph.addNode(event.id, {
                'color': common.COLOR.GREY,
                'style': common.STYLE.FILLED,
                //'shape': common.SHAPE.CIRCLE,
                //'fontname': 'helvetica',
            });
            eventNodes[node.id] = node;
        }
    }

    /** Process IONodes */
    
    Object.keys(hbGraph.fileIONodes).forEach(function (lineno) {
        var rcd = hbGraph.fileIONodes[lineno];
        if (rcd.isAsync) {
            var node = vGraph.addNode('IO' + rcd.lineno, {
                'color': common.COLOR.GREEN,
                'style': common.STYLE.FILLED,
                //'shape': common.SHAPE.CIRCLE,
                //'fontname': 'helvetica',
            });
            fileIONodes[node.id] = node;
        }
    });

    /** Process virtual event nodes */
    
    for (var [id, virtualEvent] of hbGraph.virtualEvents.entries()) {
        var node = vGraph.addNode('T' + id, {
            'color': common.COLOR.PURPLE,
            'style': common.STYLE.FILLED,
            //'shape': common.SHAPE.CIRCLE,
            //'fontname': 'helvetica',
        })
        virtualEventNodes['T' + id] = node;
    }
    /*
    console.log('virtualEventNodes:')
    Object.keys(virtualEventNodes).forEach(function (id) {
        var node = virtualEventNodes[id]
        debugHelper('#' + node.id);
        writeObj(node);
    });*/

    /** Create edges for digraph */
    
    for (var i = 0; i < hbGraph.eventNodes.length; i++) {
        var event = hbGraph.eventNodes[i];
        //Note, eventNodes is a sparse array 
        if (event != undefined) {
            if (!event.hasOwnProperty('edges')) continue;
            var edges = event.edges;
            Object.keys(edges).forEach(function (edgeType) {
                //TODO: map type name to type name id
                /** Register2Trigger */
                if (edgeType == 0) {
                    edges[edgeType].forEach(function (nextEventId) {
                        if (virtualEventNodes['T' + nextEventId] == undefined) {
                            logger.error('Register2Trigger: T' + nextEventId + ' not exist');
                            return;
                        }
                        var vEdge = vGraph.addEdge(event, virtualEventNodes['T' + nextEventId]);
                        vEdge.set( "color", "red" );
                    });
                } else if (edgeType == 1) {
                    /** Register2IO */
                    edges[edgeType].forEach(function (nextIOId) {
                        if (fileIONodes['IO' + nextIOId] == undefined) {
                            logger.error('Register2IO: IO' + nextIOId + ' not exist');
                            return;
                        }
                        var vEdge = vGraph.addEdge(event, fileIONodes['IO' + nextIOId]);
                        vEdge.set('color', 'green');
                    });
                }
            });
        }
    }

    /** Create IO2Follower edge*/
    /*
    Object.keys(hbGraph.fileIONodes).forEach(function (lineno) {
        var rcd = hbGraph.fileIONodes[lineno];
        writeObj(rcd);
        if (rcd.isAsync && rcd.hasOwnProperty('edges')) {
            var edges = rcd.edges;
            if (!edges.hasOwnProperty('1')) {
                logger.error('This async file IO has no followerCb');
                return;
            }
            var triggerIO = fileIONodes['IO' + lineno],
                followCbId = edges[1][0],
                followCb = eventNodes[followCbId],
                vEdge = vGraph.addEdge(triggerIO, followCb);
            vEdge.set("color", 'blue');
        }
    });*/

    /** Create warning nodes as additional nodes for digraph */

    /** Test */
    if (debug) {
        // Create digraph G
        var g = graphviz.digraph("G");

        // Add node (ID: Hello)
        var n1 = g.addNode( "Hello", {"color" : "blue"} );
        n1.set( "style", "filled" );

        // Add node (ID: World)
        g.addNode( "World" );

        // Add edge between the two nodes
        var e = g.addEdge( n1, "World" );
        e.set( "color", "red" );

        // Print the dot script
        console.log( g.to_dot() );

        // Set GraphViz path (if not in your path)
        g.setGraphVizPath( "/usr/local/bin" );
        // Generate a PNG output
        g.output( "png", "test01.png" );
    }

    /** Path of output file */
    
    mkdirp.sync(graphVizDir);
    console.log( vGraph.to_dot() );
    vGraph.setGraphVizPath( "/usr/local/bin" );
    console.log('generate test02 file');
    vGraph.output('png', 'test02.png');
    //vGraph.output('png', path.join(graphVizDir, path.sep, outputFileName) + '.png');
    
};