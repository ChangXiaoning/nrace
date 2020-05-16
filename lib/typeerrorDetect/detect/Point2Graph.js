class Point2Graph {
    constructor () {
        this.nodes = new Set();
        this.edges = new Set();
    }

    addNode(n) {
        this.nodes.add(n);
    }

    addEdge (src, dest) {
        this.edges.add({src, dest});
    }
}

module.exports = Point2Graph;