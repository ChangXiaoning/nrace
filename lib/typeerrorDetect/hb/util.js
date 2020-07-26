const fs = require('fs');

const AsyncObjects = require('../AsyncObjects');
const Relations = require('./Relations');

function read(hbfile, recordfile, ctxfile, ctxchainfile) {
    let hbinfo = JSON.parse(fs.readFileSync(hbfile));
    let asyncObjects = new AsyncObjects(hbinfo.objects);
    let recordinfo = JSON.parse(fs.readFileSync(recordfile));
    let records = new AsyncObjects(recordinfo.records);
    let ctxInfo = JSON.parse(fs.readFileSync(ctxfile));
    let contexts = ctxInfo.variables;
    let contextchaininfo = JSON.parse(fs.readFileSync(ctxchainfile));
    //let contextchain = contextchaininfo.contextsChain;
    let contextchain = contextchaininfo.dyContextChain;

    return {
        asyncObjects: asyncObjects,
        relations: new Relations(asyncObjects, null, null, hbinfo.relations),
        records: records,
        contexts: contexts,
        contextchain: contextchain,
    };
}

module.exports = {read}