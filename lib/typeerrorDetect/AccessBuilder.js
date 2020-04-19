const fs = require('fs');
const AsyncObjects = require('./AsyncObjects');

class AccessBuilder {
    constructor () {
        this.records = [];
    }

    push(rcd) {
        this.records.push(rcd);
    }

    store (hbFileName) {
        let recordFileName = hbFileName.replace('.hb-full.json', '.access-records.json')
        //console.log(recordFileName);
        let records = this.records;
        fs.writeFileSync(recordFileName, JSON.stringify({ records }, null, 4), 'utf-8');
    }

    extract () {
        return new AsyncObjects(this.records); 
    }
}

module.exports = AccessBuilder;