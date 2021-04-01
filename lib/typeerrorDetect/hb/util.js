const fs = require('fs');

const AsyncObjects = require('../AsyncObjects');
const Relations = require('./Relations');

function read(hbfile, recordfile, actionfile) {
    //if (recordfile) {
        let hbinfo = JSON.parse(fs.readFileSync(hbfile));
        let asyncObjects = new AsyncObjects(hbinfo.objects);
        let recordinfo = JSON.parse(fs.readFileSync(recordfile));
        let records = new AsyncObjects(recordinfo.records);
        let actioninfo = JSON.parse(fs.readFileSync(actionfile));
        let actions = actioninfo.actions;

        return {
            asyncObjects: asyncObjects,
            relations: new Relations(asyncObjects, null, null, hbinfo.relations, hbinfo.chains, hbinfo.sync, actions),
            records: records,
            actions: actions,
       };
    /*} else {
        let hbinfo = JSON.parse(fs.readFileSync(hbfile));
        let asyncObjects = new AsyncObjects(hbinfo.objects);
        return { 
            asyncObjects,
            relations: new Relations(asyncObjects, null, null, hbinfo.relations, hbinfo.chains, hbinfo.sync),
            edges: hbinfo.relations,
        };
    }*/
}

function readFullHB (fullHBFile) {
    let fullHBInfo = JSON.parse(fs.readFileSync(fullHBFile));
    let asyncObjects = new AsyncObjects(fullHBInfo.objects);
    return {
        asyncObjects,
        relations: new Relations(asyncObjects, null, null, fullHBInfo.relations, fullHBInfo.chains),
        edges: hbinfo.relations,
    }
}

function readAction (actionfile) {
    let actioninfo = JSON.parse(fs.readFileSync(actionfile));
    let actions = actioninfo.actions;

    return { actions: actions};
}

function readOperation (recordfile) {
    let recordinfo = JSON.parse(fs.readFileSync(recordfile));
    let records = new AsyncObjects(recordinfo.records);

    return { records: records };
}

module.exports = {read, readFullHB, readAction, readOperation};