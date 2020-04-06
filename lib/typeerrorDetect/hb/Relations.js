const opts = require('./config');

const registrationRule = require('./rules/registration');
const resolveRule = require('./rules/resolve');
const timeoutRule = require('./rules/timeout');
const intervalRule = require('./rules/interval');
const fifoRule = require('./rules/fifo');
const diffQRule = require('./rules/diffQ');
const promiseAllRule = require('./rules/promiseall');

class Relations {
    constructor (asyncObjs, promiseAllSet) {
        this.hb = new Array();
        this.asyncObjs = asyncObjs;
        this.promiseAllSet = promiseAllSet;
    }

    add (fore, later, type) {
        this.hb.push({fore, later, type});
    }

    happensBefore (opi, opj) {
        
    }

    isOpHB (opi, opj) {
        //console.log('isOpHB: %s, %s', JSON.stringify(opi), JSON.stringify(opj));
        if (opi.event === opj.event){
            return opi.lineno < opj.lineno;
        } else {
            let ei = this.asyncObjs.getByAsyncId(opi.event)[0],
                ej = this.asyncObjs.getByAsyncId(opj.event)[0];
            return this.isEventHB(ei, ej);
        }
    }

    isEventHB (ei, ej) {
        /*var asyncObjI = this.asyncObjs.getByAsyncId(ei)[0],
            asyncObjJ = this.asyncObjs.getByAsyncId(ej)[0];*/
        //console.log('isEventHB: %s, %s', ei, ej);
        //console.log('ei: %s', JSON.stringify(ei));
        //console.log('isReachable %s, %s, %s', ei, ej, this.isReachable(ei, ej));
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
    }
}

module.exports = Relations;