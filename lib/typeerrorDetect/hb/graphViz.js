var graphviz = require('graphviz'),
    path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    logger = require('../../../../driver/logger.js').logger,
    EdgeName2Type = require('../../HappensBeforeGraph').EdgeName2Type;

module.drawGraph = function (figName, {nodes, edges}) {
    let vGraph = graphviz.digraph('HappensBeforeGraph'),
        vertex = {};
    g.set('ordering', 'in');
    nodes.forEach(e => {
        let label = e.id;
        vertex[e.id] = vGraph.addNode(label);
    });
    edges.forEach(e => {
        if (vertex[e.a] && vertex[e.b]) {
            vGraph.addEdge(vertex[e.a], vertex[e.b], {label: e.type});
        }
    });
    console.log(figName);
    vGraph.output('png', figName);
}