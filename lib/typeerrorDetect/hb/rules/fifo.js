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
    return e.type == 'TickObject' || e.type == 'Immediate' || e.type == 'PROMISE';
};

module.exports = { apply }