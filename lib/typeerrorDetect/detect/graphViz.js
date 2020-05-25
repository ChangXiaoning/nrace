var graphviz = require('graphviz');

exports.drawGraph = function (figName, {nodes, edges}, suspectList, valList) {
    let vGraph = graphviz.digraph('DataFlowAnalysis'),
        vertex = {};
    vGraph.set('ordering', 'in');
    nodes.forEach(node => {
        let label = node;
        if (label.startsWith('obj_193'))
            vertex[node] = vGraph.addNode(label, {
                'color': 'red',
                'fillcolor': 'red',
                'shape': 'box'
            });
        else if (label.startsWith('undefined') || label.startsWith('null'))
            vertex[node] = vGraph.addNode(label, {
                'color': 'red'
            });
        else if (suspectList.find(n => n == label))
            vertex[node] = vGraph.addNode(label, {
                'color': 'purple'
            });
        else if (valList.find(n => n == label))
            vertex[node] = vGraph.addNode(label, {
                'color': 'blue'
            });
        else
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