const Graph = require('@dagrejs/graphlib').Graph;
const dijkstraAll = require('@dagrejs/graphlib').alg.dijkstraAll;
const _ = require('lodash');

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
        
        if (src == dest) return;

        if (!this.nodes.find(node => node == src))
            this.nodes.push(src);
        if (!this.nodes.find(node => node == dest))
            this.nodes.push(dest);

        this.edges.push({src, dest, type});
    }

    removeEdge (src, dest, type) {
        _.remove(this.edges, e => e.src == src && e.dest == dest && e.type == type);
    }

    searchOutComing (node) {
        return this.edges.filter(e => e.src == node);
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
            return true;
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

        if (next)
            return next;
        else
            return src;
    }

    getValNodes () {
        let nodes = this.nodes;

        return nodes.filter(node => node.startsWith('obj_') || node.startsWith('val'));
    }

    isNodeExist (node) {
        let nodes = this.nodes;
        let t = nodes.find(n => n == node);
        return t? true : false;
    }

    //----------------------------------------------------------------------
    //use graphlib
    //----------------------------------------------------------------------

    startGraphLibDataStructure() {
        console.log('start start graphlib');
        let graph = new Graph();
        let nodes = this.nodes;
        nodes.forEach(n => graph.setNode(n))
        let edges = this.edges;
        edges.forEach(e => graph.setEdge(e.src, e.dest));
        this.graph = dijkstraAll(graph);
        console.log('complete start graphlib');
    }

    canArrive2 (src, dest) {
        return this.graph[src][dest].distance > 0 &&
            this.graph[src][dest].distance != Number.POSITIVE_INFINITY;
    }

    searchPath (src, dest) {
        let path = [];
        path.push(dest);
        let _dest = this.graph[src][dest].predecessor;

        while (_dest != src) {
            path.push(_dest);
            _dest = this.graph[src][_dest].predecessor;
        }

        path.push(src);
        return path.reverse();
    }

    //----------------------------------------------------------------------
    //end graphlib
    //----------------------------------------------------------------------


    draw (filename, suspectList, valList) {
        graphviz.drawGraph(filename, {nodes: this.nodes, edges: this.edges}, suspectList, valList);
    }
}
module.exports = Point2Graph;