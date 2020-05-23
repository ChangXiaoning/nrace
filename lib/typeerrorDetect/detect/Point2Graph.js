const Graph = require('@dagrejs/graphlib').Graph;
const dijkstraAll = require('@dagrejs/graphlib').alg.dijkstraAll;

const graphviz = require('./graphViz');
class Point2Graph {
    constructor () {
        this.nodes = [];
        this.edges = [];
    }

    addNode(n) {
        this.nodes.push(n);
    }

    addEdge (src, dest, type) {
        if (!this.nodes.find(node => node == src))
            this.nodes.push(src);
        if (!this.nodes.find(node => node == dest))
            this.nodes.push(dest);

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

    isLeafNode (node) {
        return this.getOutComingNum(node) == 0;
    }

    isUndefinedNode (node) {
        return node.startsWith('undefined');
    }

    isNullNode (node) {
        return node.startsWith('null');
    }

    getUndefinedNodes () {
        let nodes = this.nodes;
        let me = this;

        return nodes.filter(node => 
            me.isUndefinedNode(node) || me.isNullNode(node));
    }

    searchDest (src) {
        let dests = this.edges.filter(edge => edge.src == src && type.startsWith('assign'))
                            .map(edge => edge.dest);
        //return the lastest one
        return dests[dests.length - 1];
    }

    //----------------------------------------------------------------------
    //use graphlib
    //----------------------------------------------------------------------

    startGraphLibDataStructure() {
        let graph = new Graph();
        let nodes = this.nodes;
        nodes.forEach(n => graph.setNode(n))
        let edges = this.edges;
        edges.forEach(e => graph.setEdge(e.src, e.dest));
        this.graph = dijkstraAll(graph);
    }

    canArrive2 (src, dest) {
        return this.graph[src][dest].distance > 0 &&
            this.graph[src][dest].distance != Number.POSITIVE_INFINITY;
    }

    //----------------------------------------------------------------------
    //end graphlib
    //----------------------------------------------------------------------


    draw (filename) {
        graphviz.drawGraph(filename, {nodes: this.nodes, edges: this.edges});
    }
}
module.exports = Point2Graph;