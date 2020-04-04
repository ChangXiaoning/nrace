const buildEventHB = require('./applyRules').buildEventHB;

class Relations {
    constructor (asyncObjs) {
        this.hb = new Array();
        this.asyncObjs = asyncObjs;
    }

    add (fore, later, type) {
        this.hb.push({fore, later, type});
    }

    happensBefore (opi, opj) {
        
    }

    isOpHB (opi, opj) {
        console.log('isOpHB: %s, %s', JSON.stringify(opi), JSON.stringify(opj));
        if (opi.event === opj.event){
            return opi.lineno < opj.lineno;
        } else {
            return this.isEventHB(opi.event, opj.event);
        }
    }

    isEventHB (ei, ej) {
        var asyncObjI = this.asyncObjs.getByAsyncId(ei)[0],
            asyncObjJ = this.asyncObjs.getByAsyncId(ej)[0];
        console.log('isEventHB: %s, %s', ei, ej);
        //console.log('ei: %s', JSON.stringify(ei));
        //console.log('isReachable %s, %s, %s', ei, ej, this.isReachable(ei, ej));
        if (this.isReachable(ei, ej)) {
            return true;
        } else if (asyncObjI.startOp.lineno < asyncObjJ.startOp.lineno) {
            buildEventHB(this.asyncObjs, ei, ej, this);
            return this.isReachable(ei, ej);
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
}

module.exports = Relations;