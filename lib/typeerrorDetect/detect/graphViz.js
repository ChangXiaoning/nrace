var graphviz = require('graphviz');

exports.drawGraph = function (figName, {nodes, edges}) {
    let vGraph = graphviz.digraph('DataFlowAnalysis'),
        vertex = {};
    vGraph.set('ordering', 'in');
    nodes.forEach(node => {
        let label = node;
        vertex[node] = vGraph.addNode(label);
    });
    //console.log('edges:%s', JSON.stringify(edges));
    edges.forEach(e => {
        if (vertex[e.src] && vertex[e.dest]) {
            vGraph.addEdge(vertex[e.src], vertex[e.dest], {label: e.type});
        }
    });
    console.log(figName);
    vGraph.output('png', figName);
}