function apply (asyncObjects, relations, ea, eb) {
    if (ea.type == 'TickObject') {
        let t = ea;
        ea = eb;
        eb = t;
    }

    if (attend(relations, ea, eb)) 
        relations.add(ea.id, eb.id, 'diffQ');
}

function attend(relations, ea, eb) {
    let pa = relations.registeredIn(ea.id);
    if (!pa)
        return false;
    return relations.happensBefore(pa, eb);
}

module.exports = { apply }