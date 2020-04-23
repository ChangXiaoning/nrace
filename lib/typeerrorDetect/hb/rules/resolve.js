function apply(asyncObjects, ei, ej, relations){
    if (ej.type == 'PROMISE' && ej.hasOwnProperty('resolved')) {
        let parent = findAsyncObjectWhereResolved(asyncObjects, ej);
        if (parent === ei) {
            relations.add(ei.id, ej.id, 'resolve');
            return true;
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

function _apply (asyncObjects, relations) {
    asyncObjects
        .getAll().filter(e => e.type == 'PROMISE' && e.hasOwnProperty('resolved') && e.id != e.current)
        .forEach(promise => {
            let parent = asyncObjects.findAsyncObjectWhereResolved(promise);
            if (parent) {
                relations.add(parent.id, promise.id, 'resolve');
            }
        });
}

module.exports = { apply, _apply }