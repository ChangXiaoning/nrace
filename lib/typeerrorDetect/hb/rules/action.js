function apply (actions, relations, ea, eb) {
    actions.forEach(a => {
        relations.add(a.event, a.id, 'action');
        relations.add(a.id, a.callback, 'action');
    });
}

module.exports = { apply }