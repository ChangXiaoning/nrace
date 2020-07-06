const fs = require('fs');

const AsyncObjects = require('../AsyncObjects');
const Relations = require('./Relations');

function read(hbfile, recordfile, ctxfile) {
    let hbinfo = JSON.parse(fs.readFileSync(hbfile));
    let asyncObjects = new AsyncObjects(hbinfo.objects);
    let recordinfo = JSON.parse(fs.readFileSync(recordfile));
    let records = new AsyncObjects(recordinfo.records);
    let ctxInfo = JSON.parse(fs.readFileSync(ctxfile));
    let contexts = ctxInfo.variables;

    return {
        asyncObjects: asyncObjects,
        relations: new Relations(asyncObjects, null, null, hbinfo.relations),
        records: records,
        contexts: contexts,
    };
}

module.exports = {read}