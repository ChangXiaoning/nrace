var graphviz = require('graphviz'),
    path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    logger = require('../../../driver/logger.js').logger;

const Action_Prefix = '*A*';

exports.drawGraph = function (figName, {nodes, edges}) {
    let vGraph = graphviz.digraph('HappensBeforeGraph'),
        vertex = {};
    vGraph.set('ordering', 'in');
    //nodes contains actions
    nodes.forEach(e => {
        //console.log(e.id);
        let label = e.id;
        vertex[e.id] = vGraph.addNode(label);
        if (label.startsWith(Action_Prefix))
            vertex[e.id].set('style', 'filled');
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