const Relations = require('./Relations');
const AsyncObjects = require('../AsyncObjects');

function reduceGraph (asyncObjects, relations) {
    let newObjs = [];
    
    asyncObjects.getAll().forEach(e => {
        if (e.callback || e.id == '1' || e.type == 'PROMISE')
            newObjs.push(e);
    });

    let nodes = new AsyncObjects(newObjs);
    let nr = new Relations(nodes, relations.promiseAllSet, relations.promiseRaceSet);
    nr._startGraphLibDataStructure();

    relations.startGraphLibDataStructure(asyncObjects.getAll());
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
            console.log('%s, %s', ei.id, ej.id);
            nr._computeGraph();
            if (!nr._happensBeforeWithGraphLib(ei.id, ej.id) && 
                !nr._happensBeforeWithGraphLib(ej.id, ei.id)) {
                if (relations.happensBeforeWithGraphLib(ei.id, ej.id)) {
                    nr.add(ei.id, ej.id, '');
                } else if (relations.happensBeforeWithGraphLib(ej.id, ei.id)) {
                    nr.add(ej.id, ei.id, '');
                }
            }
        }
    }

    //some edges in nr are duplicated; try to remove them
    removeDuplicate(nr);
    
    return {
        asyncObjects: nodes,
        relations: nr,
    };
};

function removeDuplicate (nr) {
    let allr = [...nr.hb];
    allr.forEach(r => {
        nr.remove(r.fore, r.later);
        if (!nr.happensBefore(r.fore, r.later)) {
            nr.add(r.fore, r.later, '');
        }
    });
}

module.exports = reduceGraph;