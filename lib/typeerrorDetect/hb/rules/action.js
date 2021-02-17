function _apply (actions, relations, ea, eb) {
    actions.forEach(a => {
        relations.add(a.event, a.id, 'action');
        relations.add(a.id, a.callback, 'action');
    });
}

function apply (a) {
    if (a.event) return { prior: a.event, pending: a.callback };
    else return null;
}

module.exports = { apply }