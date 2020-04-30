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
    constructor (asyncObjs, promiseAllSet, promiseRaceSet) {
        this.hb = new Array();
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
        return this.isReachable(ea, eb);
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
            return this.isEventHB(ei, ej);
        }
    }

    isOpConcur (opi, opj) {
        return ( (opi.lineno < opj.lineno && !this.isOpHB(opi, opj)) || 
        (opi.lineno > opj.lineno && !this.isOpHB(opj, opi)) )
    }

    /*isEventHB (ei, ej) {
        if (this.isReachable(ei.id, ej.id)) {
            return true;
        } else if (!ei.hasOwnProperty("startOp") || !ej.hasOwnProperty("startOp")) {
            return false;
        } else if (ei.startOp.lineno < ej.startOp.lineno) {
            this.buildEventHB(this.asyncObjs, ei, ej, this);
            return this.isReachable(ei.id, ej.id);
        } else {
            return false;
        }
    }*/

    isEventHB (ei, ej) {
        //console.log('isEventHB: %s, %s', ei.id, ej.id);
        if (this.isReachable(ei.id, ej.id)) {
            return true;
        } else {
            this.buildEventHB(this.asyncObjs, ei, ej, this);
            return this.isReachable(ei.id, ej.id);
        }
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

    buildEventHB (asyncObjs, ei, ej, relations) {
        if (opts.registration) {
            if (registrationRule.apply(asyncObjs, ei, ej, relations))
                return;
        }
        if (opts.resolve) {
            if (resolveRule.apply(asyncObjs, ei, ej, relations))
                return;
        }
        if (opts.timeout) {
            if (timeoutRule.apply(asyncObjs, ei, ej, relations))
                return;
        }
        if (opts.interval) {
            if (intervalRule.apply(asyncObjs, ei, ej, relations))
                return;
        }
        if (opts.fifo) {
            if (fifoRule.apply(asyncObjs, ei, ej, relations))
                return;
        }
        if (opts.diffQ) {
            if (diffQRule.apply(asyncObjs, ei, ej, relations))
                return;
        }
        if (opts.promiseAll) {
            promiseAllRule.apply(this.promiseAllSet, ei, ej, relations);
        }
        if (opts.promiseRace) {
            promiseRaceRule.apply(asyncObjs, this.promiseRaceSet, ei, ej, relations);
        }
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

    startGraphLibDataStructure(nodes) {
        let graph = new Graph();
        nodes.forEach(n => graph.setNode(n.id));
        this.hb.forEach(r => graph.setEdge(r.fore, r.later));
        this.graph = dijkstraAll(graph);
    }

    happensBeforeWithGraphLib(ei, ej) {
        return this.graph[ei][ej].distance > 0 &&
            this.graph[ei][ej].distance != Number.POSITIVE_INFINITY;
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

    //get the sequence of events happens before id, whose order is same
    //as the observed execution
    getHBSequence (id) {
        let res = [];
        let target_e = this.asyncObjs.getByAsyncId(id)[0];
        this.asyncObjs.getAll().forEach(e => {
            if (e.startOp.lineno < target_e.startOp.lineno) {
                //TODO
                if (this._happensBeforeWithGraphLib(e.id, id)) {
                    res.push(e.id);
                }
            }
        });
    }

    computePath (source) {
        return this.__graph[source];
    }

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
                if (paths[e].distance > 0 && path[e].distance != Number.POSITIVE_INFINITY) {
                    if (paths[e].distance > maxDis) {
                        maxDis = path[e].distance;
                        furthest = e;
                    }
                }
            });
            let p = this.getPath(source, e);
            ret.push(p);
            //remove element of arr that already in the path for next iteration
            arr = arr.filter(e => p.indexOf(e) > -1);
        }

        return ret;
    }
}

module.exports = Relations;