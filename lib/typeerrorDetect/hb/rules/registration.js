//Check if ea registers eb
function apply(asyncObjects, ea, eb, relations) {
    let parentObject = findAsyncObjectWhereRegistered(asyncObjects, eb);
    if (parentObject == ea) {
        relations.add(ea.id, eb.id, 'registration');
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

module.exports = { apply }