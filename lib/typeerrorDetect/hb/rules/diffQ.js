function apply (asyncObjects, ei, ej, relations) {
    if (ei.type != ej.type && ei.type == 'TickObject') {
        if (relations.isOpHB(ei.registerOp, ej.startOp)) {
            relations.add(ei.id, ej.id, 'diffQ');
            return true;
        }
    }
};

module.exports = { apply }