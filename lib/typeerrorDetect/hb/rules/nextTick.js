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
                    let pe = asyncObjects.getByAsyncId(lastNode)[0];
                    if (pe && pe.type == 'TickObject') {
                        if (relations.happensBefore(lastNode, e.id)) break;
                        else {
                            //if (lastNode == 15 && e.id == 18)
                                //console.log('1.debug');
                            relations.add(lastNode, e.id);
                            stack.push({chainId: key, idx: chain.indexOf(lastNode)});
                            break;
                        }
                    }
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
                                //if (ev.id == 15 && e.id == 18)
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

module.exports = { apply, _apply }