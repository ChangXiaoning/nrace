const fs = require('fs');

const AsyncObjects = require('../AsyncObjects');
const Relations = require('./Relations');

function read(file) {
    let hbinfo = JSON.parse(fs.readFileSync(file));
    let asyncObjects = new AsyncObjects(hbinfo)
    return {
        asyncObjects: new AsyncObjects(hbinfo.asyncObjects.objects),
        relations: new Relations(hbinfo.relations.hb)
    };
}

module.exports = {read}