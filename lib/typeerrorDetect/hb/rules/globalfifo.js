function apply (asyncObjects, relations, ea, eb) {
    let foundRelation = false;
    if (attend(relations, ea, eb)) {
        relations.add(ea.id, eb.id, ea.type + '-g');
        foundRelation = true;
    }

    if (!foundRelation) {
        if (attend(relations, eb, ea)) {
            relations.add(eb.id, ea.id, ea.type + '-g');
            foundRelation = true;
        }
    }
}

function attend (relations, ea, eb) {
    let pa, pb;
    if (ea.type == 'PROMISE') {
        pa = relations.resolvedIn(ea.id);
        pb = relations.resolvedIn(eb.id);

        //self-resolved then null
        //self-resolved in a promise created as a then.
        if (!pa)
            pa = relations.registeredIn(ea.id);
        if (!pb)
            pb = relations.registeredIn(eb.id);
    } else {
        pa = relations.registeredIn(ea.id);
        pb = relations.registeredIn(eb.id);
    }

    if (!pa || !pb) 
        return false;
    
    return relations.happensBefore(pa, pb);
}

module.exports = { apply, attend }