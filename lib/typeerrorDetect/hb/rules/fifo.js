function apply (asyncObjects, ei, ej, relations) {
    if (ei.type === ej.type && isTypeBelongToFIFO(ej)) {
        //console.log('fifo: %s, %s', ei.id, ej.id);
        if (relations.isOpHB(ei.registerOp, ej.registerOp)) {
            //console.log('fifo add edge (%s, %s)', ei.id, ej.id);
            relations.add(ei.id, ej.id, 'fifo');
            return true;
        }
    }
};

function isTypeBelongToFIFO (e) {
    return e.type == 'TickObject' || e.type == 'Immediate' /*|| e.type == 'PROMISE'*/;
};

function _apply (asyncObjects, relations) {
    ['TickObject', 'Immediate'].forEach(type => {
        let events = asyncObjects.getAll().filter(e => e.type == type);
        for (var i = 0; i < events.length - 1; i++) {
            if (relations.registeredInSameTick(events[i], events[i + 1]))
                relations.add(events[i].id, events[i + 1].id, type + 'fifo');
        }
    });

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
    let entry = entries.filter((entry) => entry.e === 'AsyncHook-promiseResolve' && entry.id !== entry.current);
    for (let i = 0; i < entry.length - 1; i++) {
        if (resolvedInSameTick(asyncObjects, entry[i], entry[i + 1])) { //resolved in the same tick 
            let parent = asyncObjects.getByAsyncId(entry[i].id);
            let child = asyncObjects.getByAsyncId(entry[i + 1].id);
            relations.add(parent[0].id, child[0].id, 'promise-l');
            if (parent.length !== 1 || child.length !== 1) { throw "Error"; }
        }
    }

    // promises - resolved in the same tick
    let promises = asyncObjects.getAll().filter(e => e.hasOwnProperty('resolved'));
    for (let i = 0; i <promises.length - 1; i++) {

    }

}

function findAsyncObjectWhereResolved(asyncObjects, entry) {
    let triggers = asyncObjects.getByAsyncId(entry.current);
    if (triggers.length === 0)
        return null;

    //select the closest
    for (let i = 0; i < triggers.length - 1; i++) {
        if (entry.logindex > triggers[i].beforeindex
            && entry.logindex < triggers[i + 1].beforeindex)
            return triggers[i];
    }
    return triggers[triggers.length - 1];
}

function findAsyncObjectWhereResolved (asyncObjects, asyncObj) {
    let triggers = asyncObjects.getByAsyncId(asyncObj.current);
    if (trigger.length == 0)
        return null;
    
    
}

module.exports = { apply }