const graphviz = require('../hb/graphViz');
class Point2Graph {
    constructor () {
        this.nodes = [];
        this.edges = [];
    }

    addNode(n) {
        this.nodes.push(n);
    }

    addEdge (src, dest, type) {
        if (!this.nodes.find(src))
            this.nodes.push(src);
        if (!this.nodes.find(dest))
            this.nodes.push(dest);
        if (!this.edges.find({src, dest, type}))
            this.edges.push({src, dest, type});
    }

    getNodes () {
        return this.nodes;
    }

    getOutComingNum (node) {
        let count = 0;
        this.edges.forEach(edge => {
            if (edge.src == node)
                count += 1;
        });
        return count;
    }

    draw (filename) {
        graphviz.drawGraph(filename, {nodes: this.nodes, edges: this.edges});
    }
}
module.exports = Point2Graph;