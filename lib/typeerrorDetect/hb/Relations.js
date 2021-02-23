const _ = require('lodash');
const Graph = require('@dagrejs/graphlib').Graph;
const dijkstraAll = require('@dagrejs/graphlib').alg.dijkstraAll;
const dijkstra = require('@dagrejs/graphlib').alg.dijkstra;

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
        this.nodes = [];
        this.chains = {};
    }

    addNode (n) {
        this.nodes.push(n);
    }

    add (fore, later, type) {
        this.hb.push({fore, later, type});
    }

    has (fore, later) {
        let t = this.hb.find(r => r.fore == fore && r.later == later);
        return t ? true : false;
    }

    removeIncomingTo (id) {
        _.remove(this.hb, (r) => {return r.later ==id && r.type =='resolve';});
    }


    remove(fore, later) {
        _.remove(this.hb, (r) => {return r.fore == fore && r.later == later});
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

    getChainId (eid) {
        let result = null;
        for (let chainId in this.chains) {
            let chain = this.chains[chainId];
            if (chain.indexOf(eid) > -1) {
                result = chainId;
                break;
            }
        }
        return result;
    } 

    getRegistrationPath (aoi, aoj) {
        //console.log("getRegistrationPath: %s, %s", aoi, aoj);
        let events = this.asyncObjs.getAll();
        let e = events.find(e => e.id == aoj);
        //aoj = this.asyncObjs.getByAsyncId(aoj)[0];
        let res = [];
        let found = false;
        while (e) {
            res.push(e.id);
            e = events.find(event => event.id === e.prior);
            if (!e) break;
            if (e.id == aoi) {
                found = true;
                break;
            }
        }
        if (found) res.push(aoi);
        else res = [aoj];
        return res.reverse();
    }

    startGraphLibDataStructure() {
        let graph = new Graph();
        this.nodes.forEach(n => graph.setNode(n))
        //nodes.forEach(n => graph.setNode(n.id));
        this.hb.forEach(r => graph.setEdge(r.fore, r.later));
        this.graph = dijkstraAll(graph);
    }

    computePath (source) {
        return this.graph[source];
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

}

module.exports = Relations;