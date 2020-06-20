const fs = require('fs');
const AsyncObjects = require('./AsyncObjects');

class AccessBuilder {
    constructor () {
        this.records = [];
    }

    push(rcd) {
        let candidates = [];
        let base_director = null;
        let basename = null;

        switch(rcd.entryType) {
            case 'PUTFIELD':
            case 'GETFIELD':
                candidates = this.records.filter(r => r.val == rcd.name);
                //get the nearest one
                base_director = candidates[candidates.length - 1];
                if (base_director.entryType == 'READ'){
                    basename = base_director.name;
                } else {
                    basename = base_director.prop;
                }
                
                rcd.basename = basename;
                rcd.propname = rcd.prop;
                break;
            case 'DELETE':
                candidates = this.records.filter(r => r.val == rcd.name);
                //get the nearest one
                base_director = candidates[candidates.length - 1];
                if (base_director.entryType == 'READ'){
                    basename = base_director.name;
                } else {
                    basename = base_director.prop;
                }
                let propname = this.records[this.records.length - 1].name;
                rcd.basename = basename;
                rcd.propname = propname;
                if (propname != rcd.prop)
                    rcd.prop = propname;
                break;
        }
        this.records.push(rcd);
        return rcd;
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

    ready (eLocs) {
        this.records.forEach(rcd => {
            rcd.cbLoc = eLocs[rcd.event];
        });
    }
}

module.exports = AccessBuilder;