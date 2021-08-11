function apply (e, asyncObjects, relations) {
    //if (e.id == '8')
    //console.log('fifo: %s', e.id);
    let cid = relations.getChainId(e.id);
    for (let key in relations.chains) {
        if (key == cid) continue;
        //if (key == '26')
        //console.log('debug');
        let chain = relations.chains[key];
        //console.log('chain: %s', chain)
        let outdateSync = relations.getLastSync(key, cid);
        let upperBoundIdx = outdateSync ? chain.indexOf(outdateSync.fore) :  -1;
        for (let i = upperBoundIdx + 1; i < chain.length; i++) {
            let lastNode = asyncObjects.getByAsyncId(chain[i])[0];
            if (!lastNode) continue;
            if (lastNode.type == e.type) {
                if (['TickObject', 'Immediate'].indexOf(e.type) > -1) {
                    //build FIFO rule
                    if (lastNode.prior == e.prior || relations.happensBefore(lastNode.prior, e.prior)) {
                        relations.add(lastNode.id, e.id, 'FIFO');
                        relations.updateLastSync(lastNode.id, e.id);
                    }
                } else if (e.type == 'Timeout') {
                    //build FIFO-Timeout rule
                    if (lastNode.type == e.type && !isIntervelTimer(lastNode.id) && lastNode.delayTime <= e.delayTime) {
                        if (lastNode.prior == e.prior || relations.happensBefore(lastNode.prior, e.prior)) {
                            relations.add(lastNode.id, e.id, 'timeout');
                            relations.updateLastSync(lastNode.id, e.id);
                        }
                    }
                }
            } else {
                if (e.type != 'TickObject' && lastNode.type == 'TickObject') {
                    //build NextTick rule
                    if (lastNode.prior == e.prior || relations.happensBefore(lastNode.prior, e.id)) {
                        relations.add(lastNode.id, e.id, 'nextTick');
                        relations.updateLastSync(lastNode.id, e.id);
                    }
                }
            }
        }
    }
};

function isIntervelTimer (id) {
    return id.indexOf('-') > -1;
}

module.exports = apply;