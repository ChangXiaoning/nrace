const Relations = require('./Relations');
const AsyncObjects = require('../AsyncObjects');

function reduceGraph (asyncObjects, relations, actions) {
    let newObjs = [];
    
    asyncObjects.getAll().forEach(e => {
        if (e.callback || e.id == '1' || e.type == 'PROMISE')
            newObjs.push(e);
    });

    actions.forEach(a => {
        newObjs.push(a);
    });

    let nodes = new AsyncObjects(newObjs);
    let nr = new Relations(nodes, relations.promiseAllSet, relations.promiseRaceSet);
    nr._startGraphLibDataStructure();

    relations.startGraphLibDataStructure();
    console.log("complete graphlib");

    console.log('check happens-before relation pair');
    /*for (let i = 0; i < newObjs.length - 1; i++) {
        for (let j = i + 1; j < newObjs.length; j++) {
            let ei = newObjs[i];
            let ej = newObjs[j];
            console.log('%s, %s', ei.id, ej.id);
            if (!nr.happensBefore(ei.id, ej.id) && !nr.happensBefore(ej.id, ei.id)) {
                if (relations.happensBeforeWithGraphLib(ei.id, ej.id)) {
                    nr.add(ei.id, ej.id, '');
                } else if (relations.happensBeforeWithGraphLib(ej.id, ei.id)) {
                    nr.add(ej.id, ei.id, '');
                }
            }
        }
    }*/

    for (let i = 0; i < newObjs.length - 1; i++) {
        for (let j = i + 1; j < newObjs.length; j++) {
            let ei = newObjs[i];
            let ej = newObjs[j];
            console.log('build graph: %s, %s', ei.id, ej.id);
            if (!nr._happensBeforeWithGraphLib(ei.id, ej.id) && 
                !nr._happensBeforeWithGraphLib(ej.id, ei.id)) {
                if (relations.happensBeforeWithGraphLib(ei.id, ej.id)) {
                    nr._addWithGraphLib(ei.id, ej.id, '');
                } else if (relations.happensBeforeWithGraphLib(ej.id, ei.id)) {
                    nr._addWithGraphLib(ej.id, ei.id, '');
                }
            }
        }
    }

    //some edges in nr are duplicated; try to remove them
    removeDuplicate(nr);

    //nr._buildUpGraph();
    
    return {
        asyncObjects: nodes,
        relations: nr,
    };
};

function removeDuplicate (nr) {
    let allr = [...nr.hb];
    let count = 0;
    allr.forEach(r => {
        console.log('remove duplication no.%d', count++);
        nr._removeWithGraphLib(r.fore, r.later);
        //TODO: use graphlib's happensBefore api
        if (!nr._happensBeforeWithGraphLib(r.fore, r.later)) {
            nr._addWithGraphLib(r.fore, r.later, '');
        }
    });
}

module.exports = reduceGraph;