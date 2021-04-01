const _ = require('lodash');

function _apply (asyncObjects, relations, ea, eb) {
    if (ea.type != 'TickObject') {
        let t = ea;
        ea = eb;
        eb = t;
    }

    if (attend(relations, ea, eb)) 
        relations.add(ea.id, eb.id, 'diffQ');
}

function attend(relations, ea, eb) {
    let pa = relations.registeredIn(ea.id);
    if (!pa)
        return false;
    return relations.happensBefore(pa, eb.id);
}

//Different from other rules, this rule directly adds edges into graph
//because we need to recursively build edges for this rule
//stack[] = {chainId, idx}
function apply (e, asyncObjects, relations, stack) {
    if (e.id.startsWith('*A*')) return;
    //if (e.id == 18)
        //console.log('debug');
    if (e.type != 'TickObject') {
        if (stack.length == 0) {
            let eCid = relations.getChainId(e.id);
            for (let key in relations.chains) {
                if (key == eCid) continue;
                let chain = relations.chains[key];
                for (let i = chain.length - 1; i >= 0; i--) {
                    let lastNode = chain[i];
                    if (relations.happensBefore(lastNode, e.id)) {
                        let sons = asyncObjects.getTOSons(lastNode).filter(son => relations.nodes.indexOf(son) > -1);
                        for (let son of sons) {
                            //console.log('son: %s', son)
                            if (!relations.happensBefore(son, e.id)) {
                                //if (son == '112' && e.id == '12')
                                    //console.log('1.debug');
                                relations.add(son, e.id);
                                let cid = relations.getChainId(son);
                                stack.push({chainId: cid, idx: relations.chains[cid].indexOf(son)});
                            }
                        }
                    }
                    /*let pe = asyncObjects.getByAsyncId(lastNode)[0];
                    if (pe && pe.type == 'TickObject') {
                        if (relations.happensBefore(lastNode, e.id)) break;
                        else {
                            if (lastNode == 112 && e.id == 12)
                                console.log('1.debug');
                            relations.add(lastNode, e.id);
                            stack.push({chainId: key, idx: chain.indexOf(lastNode)});
                            break;
                        }
                    }*/
                }
            }
        }
        while (stack.length > 0) {
            let stackEle = stack.shift(),
                chainId = stackEle.chainId,
                idx = stackEle.idx,
                chain = relations.chains[chainId],
                registrationOperations = [];
            chain.forEach((eid, index) => {
                if (index < idx) {
                    asyncObjects
                        .getAll()
                        .filter(ev => relations.nodes.indexOf(ev.id) > -1 && ev.prior == eid && ev.type == 'TickObject')
                        .forEach(ev => {
                            if (ev.id == e.id) return true;
                            if (!relations.happensBefore(ev.id, e.id)) {
                                //if (ev.id == '112' && e.id == '12')
                                //console.log('2.debug');
                                relations.add(ev.id, e.id);
                                //console.log(e.id);
                                let cid = relations.getChainId(ev.id);
                                //console.log(cid);
                                let index = relations.chains[cid].indexOf(ev.id);
                                stack.push({ chainId: cid, idx: index });
                            }
                        });
                }
            });
        }
    }
}

function apply (e, asyncObjects, relations) {
    if (e.id.startsWith('*A*')) return;
    if (e.type == 'TickObject') return;

    let cid = relations.getChainId(e.id);
    let nexttickSet = [];
    let subNextTickSet = [];
    for (let key in relations.chains) {
        if (key == cid) continue;
        let chain = relations.chains[key];
        //console.log('chain: %s', chain)
        let outdateSync = relations.getLastSync(key, cid);
        let upperBoundIdx = outdateSync ? chain.indexOf(outdateSync.fore) :  -1;
        for (let i = chain.length - 1; i > upperBoundIdx; i--) {
            let lastNode = asyncObjects.getByAsyncId(chain[i])[0];
            if (!lastNode) continue;
            if (lastNode.type == 'TickObject') {
                nexttickSet.push(lastNode.id);
            }
        }
    }

    var lastNum = null;
    //var copy = _.cloneDeep(relations.chains);
    do {
        lastNum = nexttickSet.length;
        for (let key in relations.chains) {
            if (key == cid) continue;
            //if (key == '26')
            //console.log('debug');
            let chain = relations.chains[key];
            let outdateSync = relations.getLastSync(key, cid);
            let upperBoundIdx = outdateSync ? chain.indexOf(outdateSync.fore) :  -1;
            for (let i = chain.length - 1; i > upperBoundIdx; i--) {
                let lastNode = asyncObjects.getByAsyncId(chain[i])[0];
                if (!lastNode) continue;
                if (lastNode.type == 'TickObject') {
                    let parent = lastNode.prior;
                    //fix bug
                    if (relations.happensBefore(parent, e.id)) {
                        relations.add(lastNode.id, e.id, 'nextTick');
                        //remove nodes before lastNode in the same
                        //chain from nexttickSet
                        for (let j = i; j > upperBoundIdx; j--) {
                            _.remove(nexttickSet, (e) => {return nexttickSet.indexOf(e) > -1;});
                        }
                        relations.updateLastSync(lastNode.id, e.id);
                        //relations.reduceChain(lastNode.id, e.id);
                        break;
                    }
                }
            }
        }
    } while (nexttickSet.length < lastNum)
}

function applyNextTickRule (e) {
    var promiseCollection = collect(chains, e);
    var lastLen = 0;

    do {
        lastLen = promiseCollection.length;
        for (let chain of chains) {
            let upperBoundIdx = chain.lastSync;
            for (let i = chain.length - 1; i > upperBoundIdx; i--) {
                let node = chain[i];
                if (checkPremise(node, e)) {
                    relations.add(node, e);
                    deleteFrom(promiseCollection, upperBoundIdx, node);
                    updateSync(node, e);
                }
            }
        }
    } while (promiseCollection.length < lastLen);
}

module.exports = { apply, _apply }