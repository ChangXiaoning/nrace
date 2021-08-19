
//check if aoi happens before aoj according to interval rule
function apply (aoi, aoj, asyncObjects, relations) {
    let foundRelation = false;
    if (aoi.type == aoj.type && aoj.type == 'Timeout') {
        let metedatai = aoi.id.split('-'),
            basei = metedatai[0],
            offseti = metedatai[1] ? parseInt(metedatai[1]) : 1;
        let metedataj = aoj.id.split('-'),
            basej = metedataj[0],
            offsetj = metedataj[1] ? parseInt(metedataj[1]) : 1;
        if (basei == basej && offseti < offsetj) {
            relations.add(aoi, aoj, 'interval');
            foundRelation = true;
        }
    }
    return foundRelation;
}

module.exports = {apply};