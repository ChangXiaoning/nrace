var graphviz = require('graphviz'),
    path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    logger = require('../../../driver/logger.js').logger;

exports.drawGraph = function (figName, {nodes, edges}) {
    let vGraph = graphviz.digraph('HappensBeforeGraph'),
        vertex = {};
    vGraph.set('ordering', 'in');
    nodes.forEach(e => {
        let label = e.id;
        vertex[e.id] = vGraph.addNode(label);
    });
    console.log('edges:%s', JSON.stringify(edges));
    edges.forEach(e => {
        if (vertex[e.fore] && vertex[e.later]) {
            vGraph.addEdge(vertex[e.fore], vertex[e.later], {label: e.type});
        }
    });
    console.log(figName);
    vGraph.output('png', figName);
}