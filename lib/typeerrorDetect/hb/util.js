const fs = require('fs');

const AsyncObjects = require('../AsyncObjects');
const Relations = require('./Relations');

function read(hbfile, recordfile, ctxfile, ctxchainfile, actionfile) {
    if (recordfile) {
        let hbinfo = JSON.parse(fs.readFileSync(hbfile));
        let asyncObjects = new AsyncObjects(hbinfo.objects);
        let recordinfo = JSON.parse(fs.readFileSync(recordfile));
        let records = new AsyncObjects(recordinfo.records);
        let ctxInfo = JSON.parse(fs.readFileSync(ctxfile));
        let contexts = ctxInfo.variables;
        let contextchaininfo = JSON.parse(fs.readFileSync(ctxchainfile));
        //let contextchain = contextchaininfo.contextsChain;
        let contextchain = contextchaininfo.dyContextChain;
        let actioninfo = JSON.parse(fs.readFileSync(actionfile));
        let actions = actioninfo.actions;

        return {
            asyncObjects: asyncObjects,
            relations: new Relations(asyncObjects, null, null, hbinfo.relations),
            records: records,
            contexts: contexts,
            contextchain: contextchain,
            actions: actions,
        };
    } else {
        let hbinfo = JSON.parse(fs.readFileSync(hbfile));
        let asyncObjects = new AsyncObjects(hbinfo.objects);
        return { 
            asyncObjects,
            relations: new Relations(asyncObjects, null, null, hbinfo.relations),
            edges: hbinfo.relations,
        };
    }
}

function readFullHB (fullHBFile) {
    let fullHBInfo = JSON.parse(fs.readFileSync(fullHBFile));
    let asyncObjects = new AsyncObjects(fullHBInfo.objects);
    return new Relations(asyncObjects, null, null,fullHBInfo.relations);
}

module.exports = {read, readFullHB};