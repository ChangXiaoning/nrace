class Relations {
    constructor () {
        this.hb = new Array();
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
            return this.isEventHB(opi.event, opj.event);
        }
    }

    isEventHB (ei, ej) {
        //console.log('isEventHB: %s, %s', ei.id, ej.id);
        if (this.isReachable(ei, ej)) {
            return true;
        } else if (ei.startOp.lineno < ej.startOp.lineno) {
            buildEventHB(ei, ej);
            return isReachable(ei, ej);
        } else {
            return false;
        }
    }

    isReachable (ei, ej) {
        var visited = new Array();
        visited[ei] = true;
        this.dfs (visited, ei, ej);
    }

    dfs(visited, ei, ej) {
        if (ei === ej) {
            return true;
        }
        var self = this;
        //console.log('this: %s', JSON.stringify(this));
        this.hb
            .filter(relation => {relation.fore === ei;})
            .forEach(relation => {
                var ek = relation.later;
                if (visited[ek] === false) {
                    visited[ek] = true;
                    /*if self.dfs(visited, ek, ej) {
                        return true;
                    }*/
                    visited[ek] = false;
                }
            });
        return false;
    }
}

module.exports = Relations;