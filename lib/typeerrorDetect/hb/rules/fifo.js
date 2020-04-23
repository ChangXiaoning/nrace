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
            relations.add(promise[i].id, promise[i + 1].id, 'promise-fifo');
        }
    }
}

function resolvedInSameTick (asyncObjects, e1, e2) {
    let pe1 = asyncObjects.findAsyncObjectWhereResolved(e1),
        pe2 = asyncObjects.findAsyncObjectWhereResolved(e2);
    return pe1.id == pe2.id;
}

module.exports = { apply, _apply };