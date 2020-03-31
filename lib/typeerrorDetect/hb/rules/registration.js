//Check if ea registers eb
function apply(asyncObjects, ea, eb, relations) {
    let parentObject = findAsyncObjectWhereRegistered(asyncObjects, eb);
    if (parentObject == ea) {
        relations.add(ea.id, eb.id, 'registration');
    }
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

module.exports = { apply }