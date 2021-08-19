function apply (aoi, aoj, relations) {
    let foundRelation = false;
    // assume aoi is always the tickObject
    if (aoj.type == 'TickObject') {
        let tmp = aoi;
        aoi = aoj;
        aoj = tmp;
    }
    if (attend(aoi, aoj, relations)) {
        relations.add(aoi.id, aoj.id, 'nexttick');
        foundRelation = true;
    }
    return foundRelation;
}

function attend(aoi, aoj, relations) {
    let parent_of_cbi = relations.registeredIn(aoi.id);

    if (!parent_of_cbi)
        return false;

    return relations.basicHappensBefore(parent_of_cbi, aoj.id);
}

module.exports = { apply }