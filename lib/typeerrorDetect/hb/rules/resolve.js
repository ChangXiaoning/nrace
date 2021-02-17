//get the event that registers the given event
function apply(asyncObjects, e){
    //console.log('resolve eid: %s', e.id);
    if (e.type == 'PROMISE' && e.hasOwnProperty('resolved') && e.id != e.resolved.current) {
        let parent = asyncObjects.findAsyncObjectWhereResolved(e);
        //console.log('resolve: %s', parent);
        if (parent) {
            //console.log('resolve: %s -> %s', parent.id, e.id);
            return parent.id;
        }
    }
    return null;
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
        .getAll().filter(e => e.type == 'PROMISE' && e.hasOwnProperty('resolved') && e.id != e.resolved.current)
        .forEach(promise => {
            let parent = asyncObjects.findAsyncObjectWhereResolved(promise);
            if (parent) {
                relations.add(parent.id, promise.id, 'resolve');
            }
        });
}

module.exports = { apply, _apply }