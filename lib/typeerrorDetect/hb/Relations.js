const _ = require('lodash');
const Graph = require('@dagrejs/graphlib').Graph;
const dijkstraAll = require('@dagrejs/graphlib').alg.dijkstraAll;
const dijkstra = require('@dagrejs/graphlib').alg.dijkstra;

const opts = require('./config');

const registrationRule = require('./rules/registration');
const resolveRule = require('./rules/resolve');
const timeoutRule = require('./rules/timeout');
const intervalRule = require('./rules/interval');
const fifoRule = require('./rules/fifo');
const diffQRule = require('./rules/diffQ');
const promiseAllRule = require('./rules/promiseall');
const promiseRaceRule = require('./rules/promiserace');

class Relations {
    constructor (asyncObjs, promiseAllSet, promiseRaceSet, hb) {
        //this.hb = new Array();
        if (arguments.length == 3) {
            this.hb = new Array();
        } else {
            this.hb = hb;
        }
        this.asyncObjs = asyncObjs;
        this.promiseAllSet = promiseAllSet;
        this.promiseRaceSet = promiseRaceSet;
    }

    add (fore, later, type) {
        this.hb.push({fore, later, type});
    }

    _addWithGraphLib (fore, later, type) {
        this.hb.push({fore, later, type});
        this._graph.setEdge(fore, later);
        this.__graph = dijkstraAll(this._graph);
    }

    removeIncomingTo (id) {
        _.remove(this.hb, (r) => {return r.later ==id && r.type =='resolve';});
    }


    remove(fore, later) {
        _.remove(this.hb, (r) => {return r.fore == fore && r.later == later});
    }

    _removeWithGraphLib (fore, later) {
        _.remove(this.hb, (r) => {return r.fore == fore && r.later == later});
        this._graph.removeEdge(fore, later);
        this.__graph = dijkstraAll(this._graph);
    }

    _buildUpGraph () {
        this.__graph = dijkstraAll(this._graph);
    }

    removeFromPromiseRaceSet (id) {
        //let flag = false;
        for (var i = 0; i < this.promiseRaceSet.length; i++) {
            let cur = this.promiseRaceSet[i];
            let index = cur.indexOf(id);
            if (index != -1) {
                cur.splice(index, 1);
                this.promiseRaceSet[i] = cur;
                return;
            }
        }
    }

    happensBefore (ea, eb) {
        if (ea == eb)
            return false;
        else 
            return this.isReachable(ea, eb);
    }

    happensBefore(aoi, aoj) {
        //console.log('new visite: %s, %s', aoi, aoj);
        let visited = {};
        let rels = this.hb.filter(r => r.fore === aoi);
        while (rels.length > 0) {
            let relation = rels.pop();
            if (!visited[relation.later]) {
                visited[relation.later] = true;

                if (relation.later === aoj)
                    return true;
                else {
                    let ind_rels = this.hb.filter(r => r.fore === relation.later);
                    rels.push(...ind_rels);
                }
            }
        }
        return false;
    }

    isOpHB (opi, opj) {
        //console.log('isOpHB: %s, %s', JSON.stringify(opi),
        //JSON.stringify(opj));
        if (opi == undefined || opj == undefined) return false;
        if (opi.event === opj.event){
            return opi.lineno < opj.lineno;
        } else {
            let ei = this.asyncObjs.getByAsyncId(opi.event)[0],
                ej = this.asyncObjs.getByAsyncId(opj.event)[0];
            return this.happensBeforeWithGraphLib(opi.event, opj.event);
        }
    }

    isOpConcur (opi, opj) {
        return ( (opi.lineno < opj.lineno && !this.isOpHB(opi, opj)) || 
        (opi.lineno > opj.lineno && !this.isOpHB(opj, opi)) )
    }

    isReachable (ei, ej) {
        var visited = {};
        visited[ei] = true;
        return this.dfs (visited, ei, ej);
    }

    dfs(visited, ei, ej) {
        //console.log('enter dfs %s, %s', ei, ej);
        if (ei === ej) {
            return true;
        }

        for (var i = 0; i < this.hb.length; i++) {
            var relation = this.hb[i];
            if (relation.fore == ei) {
                var ek = relation.later;
                if (visited[ek] != true) {
                    visited[ek] = true;
                    if (this.dfs(visited, ek, ej)) {
                        return true;
                    }
                    visited[ek] = false;
                }
            }
        }
        return false;
    }


    registeredInSameTick(aid, bid) {
        let pa = this.hb.find(h => h.later == aid && h.type == 'registration');
        let pb = this.hb.find(h => h.later == bid && h.type == 'registration');
        if (!pa || !pb)
            return false;

        return pa.fore == pb.fore;
    }

    registeredIn (latId) {
        let r = this.hb.find(r => r.later == latId && r.type == 'registration');
        if (r)
            return r.fore;
        return null;
    }

    resolvedIn (latId) {
        let r = this.hb.find(r => r.later == latId && r.type == 'resolve');
        if (r)
            return r.fore;
        return null;
    }

    startGraphLibDataStructure() {
        let graph = new Graph();
        this.asyncObjs.getAll().forEach(n => graph.setNode(n.id))
        //nodes.forEach(n => graph.setNode(n.id));
        this.hb.forEach(r => graph.setEdge(r.fore, r.later));
        this.graph = dijkstraAll(graph);
    }

    happensBeforeWithGraphLib(ei, ej) {
        if (this.graph[ei][ej] == null) return false;
        else
            return  this.graph[ei][ej].distance != Number.POSITIVE_INFINITY &&
                this.graph[ei][ej].distance > 0;
    }

    isConcurWithGraphLib (ei, ej) {
        return this.graph[ei][ej].distance == Number.POSITIVE_INFINITY &&
            this.graph[ej][ei].distance == Number.POSITIVE_INFINITY;
    }

    _startGraphLibDataStructure () {
        this._graph = new Graph();
        this.asyncObjs.getAll().forEach(n => this._graph.setNode(n.id));
        //this.hb.forEach(r => this._graph.setEdge(r.fore, r.later));
        this.__graph = dijkstraAll(this._graph);
    }

    _happensBeforeWithGraphLib(ei, ej) {
        return this.__graph[ei][ej].distance > 0 &&
            this.__graph[ei][ej].distance != Number.POSITIVE_INFINITY;
    }

    computePath (source) {
        return this.graph[source];
    }

    /**
     * Given id of event, return the events that prior to the event,
     * according to the registration relation
     * @param {String} id 
     * @returns {Array} the list of events that happens before the
     * given event, according to registration relation, in the reverse
     * order (from near to far), including the event itself and `1`
     */
    getAllAncestor (id) {
        let res = [];

        let event = this.asyncObjs.getByAsyncId(id)[0];
        while (event) {
            res.push(event.id);
            event = event.prior;
        }
        return res;
    }

    getAllAncestorForAllEvents () {
        let res = {};
        let me = this;
        let events = this.asyncObjs.getAll();
        for (let event of events) {
            if (event.id == "1") continue;
            res[event.id] = me.getAllAncestor(event.id);
        }
        return res;
    }

    /**
     * Given id of event, return the events that after the event,
     * according to registration relation
     * @param {String} id 
     * @returns {Array} return the array of events that after the
     * event, in the order from near to far
     */
    getAllOffspring (id) {
        let res = [];
        let visited = {};
        let rels = this.hb.filter(r => r.fore === id && r.type === 'ASYNC_INIT');
        while (rels.length > 0) {
            let relation = rels.pop();
            if (!visited[relation.later]) {
                visited = true;
                
                let ind_rels = this.hb.filter(r => r.fore === relation.later && r.type === 'ASYNC_INIT');
                rels.push(...ind_rels);
            }
        }
        res = Object.keys(visited);
        return res;
    }

    /**
     * Check if aoi happens before aoj according to registration relation.
     * If aoi happens before aoj, return the path, else return the
     * empty array
     * @param {*} aoi 
     * @param {*} aoj 
     */
    startRegistrationGraphLibDataStructure() {
        let graph = new Graph();
        this.asyncObjs.getAll().forEach(n => graph.setNode(n.id));
        this.hb.forEach((r) => {
            if (r.type == 'registration')
                graph.setEdge(r.fore, r.later);
        });
        this.registrationGraph = dijkstraAll(graph);
    }

    getRegistrationPath (aoi, aoj) {
        //console.log("getRegistrationPath: %s, %s", aoi, aoj);
        let res = [];
        if (this.registrationGraph[aoi][aoj].distance > 0 && this.registrationGraph[aoi][aoj].distance != Number.POSITIVE_INFINITY) {
            let next = aoj;
            while (next != aoi) {
                res.push(next);
                next = this.registrationGraph[aoi][next].predecessor;
            }
            res.push(aoi);
        }
        return res.reverse();
    }

    //------------------------------API for DataFlowAnalyzer------------------------------//
    
    getPath (source, dist) {
        //ensure that there is a path from source to dist
        let paths = this.computePath(source);
        if (paths[dist].distance > 0 && paths[dist].distance != Number.POSITIVE_INFINITY) {
            let ret = [];
            let next = dist;
            while (next != source) {
                ret.push(next);
                next = paths[next].predecessor;
            }
            //return the path from source to dist (including source
            //and dist)
            ret.push(source);
            return ret.reverse();
        } else {
            return null;
        }
    }

    //return several paths that from source to element of arr
    getPaths (source, arr) {
        let ret = [];
        let paths = this.computePath(source);
        
        while (arr.length > 0) {
            let maxDis = 0;
            let furthest = null;
            //search for the furthest event of arr from source
            arr.forEach(e => {
                if (paths[e].distance > 0 && paths[e].distance != Number.POSITIVE_INFINITY) {
                    if (paths[e].distance > maxDis) {
                        maxDis = paths[e].distance;
                        furthest = e;
                    }
                }
            });
            let p = this.getPath(source, furthest);
            ret.push(p);
            //remove element of arr that already in the path for next iteration
            arr = arr.filter(e => p.indexOf(e) == -1);
        }

        return ret;
    }
}

module.exports = Relations;