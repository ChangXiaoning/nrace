const { attend } = require('./globalfifo');

function apply (asyncObjects, relations, ea, eb) {
    let foundRelation = false;
    if (ea.delayTime <= eb.delayTime && attend(relations, ea, eb)) {
        relations.add(ea.id, eb.id, ea.type + '-g');
        foundRelation = true;
    }

    if (!foundRelation) {
        if (eb.delayTime <= ea.delayTime && attend(relations, eb, ea)) {
            relations.add(eb.id, ea.id, 'timeout-g');
        }
    }
}

module.exports = { apply }