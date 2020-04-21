//Check if ea registers eb
function apply(asyncObjects, ea, eb, relations) {
    let parentObject = findAsyncObjectWhereRegistered(asyncObjects, eb);
    if (parentObject == ea) {
        relations.add(ea.id, eb.id, 'registration');
        return true;
    }
};

function findAsyncObjectWhereRegistered(asyncObjects, asyncObj) {
    let register = asyncObjects.getByAsyncId(asyncObj.prior);
    if (register && register.length == 1) {
        return register[0];
    } else {
        // For some system events, their prior is 0, which does not
        // exist before
        return null;
    }
};

function _apply (asyncObjects, relations) {
    asyncObjects.getAll().forEach(e => {
        let parent = findAsyncObjectWhereRegistered(asyncObjects, e);
        if (parent) {
            relations.add(parent.id, e.id, 'registration');
        }
    })
}

module.exports = { apply }