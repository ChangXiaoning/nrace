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

    //for delete x.p, x will point to undefined node
    //however, ???
    getOutComingNum (node) {
        let count = 0;
        this.edges.forEach(edge => {
            if (edge.src == node)
                count += 1;
        });
        return count;
    }

    isLeafNode (node) {
        if (!node)
            return false;
        else 
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

    //this method is used for putfield:
    //for x.p = y, we want to know which object that x currently
    //points to
    //TODO: bug?
    searchObjDest (src) {
        let _src = null;
        let edge = null;
        let next = null;
        let me = this;

        edge = this.edges.find(edge => edge.src == src);
        if (edge)
            next = edge.dest;
        
        while (!me.isLeafNode(next)) {
            _src = next;
            edge = this.edges.find(edge => edge.src == _src);
            if (edge)
                next = edge.dest;
        }

        return next;
    }

    getValNodes () {
        let nodes = this.nodes;

        return nodes.filter(node => node.startsWith('obj_') || node.startsWith('val'));
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