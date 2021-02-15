function _apply (actions, relations, ea, eb) {
    actions.forEach(a => {
        relations.add(a.event, a.id, 'action');
        relations.add(a.id, a.callback, 'action');
    });
}

//TODO: deal with action and its callback
//get the event that registers the given async task
function apply (a) {
    if (a.event) return a.event;
    else return null;
}

module.exports = { apply }