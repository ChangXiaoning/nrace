class Point2Graph {
    constructor () {
        this.nodes = new Set();
        this.edges = new Set();
    }

    addNode(n) {
        this.nodes.add(n);
    }

    addEdge (src, dest, type) {
        this.edges.add({src, dest, type});
    }
}

module.exports = Point2Graph;