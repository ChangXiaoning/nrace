function apply (aoi, aoj, relations) {
    let foundRelation = false;
    if (attend(aoi, aoj, relations)) {
        relations.add(aoi.id, aoj.id, 'fifo');
        foundRelation = true;
    }
    return foundRelation;
}

function attend (aoi, aoj, relations) {
    let parent_of_aoi, parent_of_aoj;
    if (aoi.type == 'PROMISE') {
        parent_of_aoi = relations.resolvedIn(aoi.id);
        parent_of_aoj = relations.resolvedIn(aoj.id);

        //self-resolved then null
        //self-resolved in a promise created as a then.
        if (!parent_of_aoi)
            parent_of_aoi = relations.registeredIn(aoi.id);

        if (!parent_of_aoj)
            parent_of_aoj = relations.registeredIn(aoj.id);
    } else {
        parent_of_aoi = relations.registeredIn(aoi.id);
        parent_of_aoj = relations.registeredIn(aoj.id);
    }

    if (!parent_of_aoi || !parent_of_aoj)
        return false;
    
    if (parent_of_aoi == parent_of_aoj)
        return aoi.registerOp.lineno < aoj.registerOp.lineno;
    
    return relations.basicHappensBefore(parent_of_aoi, parent_of_aoj);
}

module.exports = { apply, attend }