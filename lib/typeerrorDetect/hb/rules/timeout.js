function apply(e, asyncObjects, relations) {
    let result = [];
    if (e.type == 'Timeout') {
        if (e.id == '9')
        console.log('timeout: %s', e.id);
        for (let key in relations.chains) {
            let chain = relations.chains[key];
            //console.log('chain: %s', chain)
            for (let i = chain.length - 1; i >= 0; i--) {
                let lastNode = asyncObjects.getByAsyncId(chain[i])[0];
                if (!lastNode) continue;
                if (lastNode.type == e.type && !isIntervelTimer(lastNode.id) && lastNode.delayTime <= e.delayTime) {
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

function findAsyncObjectWhereRegistered(asyncObjects, asyncObj) {
    //TODO: promise has no prior property
    let register = asyncObjects.getByAsyncId(asyncObj.prior);
    if (register && register.length == 1) {
        return register[0];
    } else {
        return null;
    }
};

function _apply (asyncObjects, relations) {
    let timers = asyncObjects.getAll().filter(t => t.type == 'Timeout');
    
    let groups = {};
    timers.forEach(timer => {
        let tick = relations.registeredIn(timer.id);
        if (!groups[tick])
            groups[tick] = [];
        
        //interval - only the first one is included
        if (! isIntervelTimer(timer.id)) 
            groups[tick].push(timer);
    });

    for (let tick in groups) {
        let timers = groups[tick];
        for (let i = 0; i < timers.length - 1; i++) {
            for (let j = i + 1; j < timers.length; j++) {
                if (timers[i].delayTime <= timers[j].delayTime)
                    relations.add(timers[i].id, timers[j].id, 'timeout');
            }
        }
    }

}

function isIntervelTimer (id) {
    return id.indexOf('-') > -1;
}

module.exports = { apply, _apply };