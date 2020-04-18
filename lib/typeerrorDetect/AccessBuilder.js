var fs = require('fs');
class AccessBuilder {
    constructor () {
        this.records = [];
    }

    push(rcd) {
        this.records.push(rcd);
    }

    store (hbFileName) {
        let recordFileName = hbFileName.replace('.hb-full.json', '.access-records.json')
        console.log(recordFileName);
        //fs.writeFileSync(hbFileName, JSON.stringify({ relations },
        //null, 4), 'utf-8');
        let records = this.records;
        fs.appendFileSync(recordFileName, JSON.stringify({ records }, null, 4), 'utf-8');
    }
}

module.exports = AccessBuilder;