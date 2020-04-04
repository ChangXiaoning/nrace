function apply(asyncObjects, ei, ej, relations){
    if (ej.type == 'PROMISE' && ej.hasOwnProperty('resolved')) {
        let parent = findAsyncObjectWhereResolved(asyncObjects, ej);
        if (parent === ei) {
            relations.add(ei.id, ej.id, 'resolve');
        }
    }
};

function findAsyncObjectWhereResolved (asyncObjects, e) {
    let current = asyncObjects.getByAsyncId(e.resolved.current);
    if (current.length == 0) {
        return null;
    } else {
        return current[0];
    }
};

module.exports = { apply }