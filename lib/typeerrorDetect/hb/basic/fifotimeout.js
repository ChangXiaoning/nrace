const { attend } = require('./fifo');

function apply (aoi, aoj, relations) {
    let foundRelation = false;
    if (aoi.delayTime <= aoj.delayTime && attend(aoi, aoj, relations)) {
        relations.add(aoi.id, aoj.id, 'fifo-timeout');
        foundRelation = true;
    }
    return foundRelation;
}

module.exports = { apply }