function apply (e, asyncObjects, relations) {
    let result = [];
    if (['TickObject', 'Immediate'].indexOf(e.type) > -1) {
        //if (e.id == '8')
        //console.log('fifo: %s', e.id);
        let cid = relations.getChainId(e.id);
        for (let key in relations.chains) {
            if (key == cid) continue;
            let chain = relations.chains[key];
            //console.log('chain: %s', chain)
            for (let i = chain.length - 1; i >= 0; i--) {
                let lastNode = asyncObjects.getByAsyncId(chain[i])[0];
                if (!lastNode) continue;
                if (lastNode.type == e.type) {
                    //check if lastNode and e are registered in the same tick
                    if (lastNode.prior == e.prior) {
                        result.push(lastNode.id);
                        break;
                    } else {
                        let pLastNode = lastNode.prior;
                        let pe = e.prior;
                        if (relations.happensBefore(pLastNode, pe)) {
                            result.push(lastNode.id);
                            break;
                        }
                    }
                }
            }
        }
    }
    return result;
};

function apply (e, asyncObjects, relations) {
    let result = [];
    if (['TickObject', 'Immediate'].indexOf(e.type) > -1) {
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
            for (let i = chain.length - 1; i > upperBoundIdx; i--) {
                let lastNode = asyncObjects.getByAsyncId(chain[i])[0];
                if (!lastNode) continue;
                if (lastNode.type == e.type) {
                    //check if lastNode and e are registered in the same tick
                    //console.log('fifo: %s, %s', lastNode.id, e.id)
                    if (lastNode.prior == e.prior) {
                        result.push(lastNode.id);
                        break;
                    } else {
                        let pLastNode = lastNode.prior;
                        let pe = e.prior;
                        if (relations.happensBefore(pLastNode, pe)) {
                            result.push(lastNode.id);
                            break;
                        }
                    }
                }
            }
        }
    }
    return result;
};

function apply (e, asyncObjects, relations) {
    let result = [];
    if (['TickObject', 'Immediate'].indexOf(e.type) > -1) {
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
                    //check if lastNode and e are registered in the same tick
                    //console.log('fifo: %s, %s', lastNode.id, e.id)
                    if (lastNode.prior == e.prior) {
                        result.push(lastNode.id);
                        break;
                    } else {
                        let pLastNode = lastNode.prior;
                        let pe = e.prior;
                        if (relations.happensBefore(pLastNode, pe)) {
                            result.push(lastNode.id);
                            //break;
                        }
                    }
                }
            }
        }
    }
    return result;
};

function isTypeBelongToFIFO (e) {
    return e.type == 'TickObject' || e.type == 'Immediate' /*|| e.type == 'PROMISE'*/;
};

function _apply (asyncObjects, relations) {
    ['TickObject', 'Immediate'].forEach(type => {
        let events = asyncObjects.getAll().filter(e => e.type == type);
        for (var i = 0; i < events.length - 1; i++) {
            if (relations.registeredInSameTick(events[i].id, events[i + 1].id))
                relations.add(events[i].id, events[i + 1].id, type + 'fifo');
        }
    });

    // promises registered for the same 'p.then(cb1); p.then(cb2);' so cb1 -> cb2
    let promisesThen = asyncObjects.getAll().filter(e =>
            e.type == 'PROMISE' &&
            e.entryType == 'ASYNC_INIT' &&
            e.trigger != e.current);
    for (let i = 0; i < promisesThen.length - 1; i++) {
        let curr = promisesThen[i], next = promisesThen[i+1];
        // registered in the same tick with same trigger promise
        if (curr.trigger == next.trigger && curr.current == next.current) {
            let parent = asyncObjects.getByAsyncId(curr.id),
                child = asyncObjects.getByAsyncId(next.id);
            relations.add(parent[0].id, child[0].id, 'promise-then');
        }
    }

    // promises - resolved in the same tick
    let promises = asyncObjects.getAll().filter(e => e.hasOwnProperty('resolved'));
    for (let i = 0; i <promises.length - 1; i++) {
        if (resolvedInSameTick(asyncObjects, promises[i], promises[i + 1])) {
            relations.add(promises[i].id, promises[i + 1].id, 'promise-fifo');
        }
    }
}

function resolvedInSameTick (asyncObjects, e1, e2) {
    let pe1 = asyncObjects.findAsyncObjectWhereResolved(e1),
        pe2 = asyncObjects.findAsyncObjectWhereResolved(e2);
    return pe1.id == pe2.id;
}

module.exports = { apply, _apply };