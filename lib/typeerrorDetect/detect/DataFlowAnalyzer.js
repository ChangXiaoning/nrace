const logger = require('../../../driver/logger.js').logger;

class DataFlowAnalyzer {
    constructor (asyncObjects, records, rg) {
        this.asyncObjects = asyncObjects;
        this.records = records;
        this.rg = rg;

        this.identifyUndefRcd();
    }

    identifyUndefRcd () {
        this.undefRcd = this.records.getAll().filter(rcd => 
            rcd.entryType == 'WRITE' && rcd.val == '-2');
    }

    findDataChangePaths () {
        //TODO: we only consider each name with one undefined record
        let dataChangePaths = {};
        this.undefRcd.forEach(undef => {
            let eid = undef.event;
            let root = '1'
            let path = this.rg.getPath(root, eid);
            let copy = path.slice();
            //the start of path is the first event access to undef.name
            for (let i = 0; i < copy.length; i++) {
                let e = copy[i]
                let r = this.records
                        .getAll()
                        .filter(rcd => rcd.event == e)
                        .find(rcd => rcd.name == undef.name);
                if (!r) {
                    path.splice(path.indexOf(e), 1);
                    break;
                }
            }
            //Remove the event from path, which does not write
            //undef.name
            copy = path.slice();
            for (let i = 0; i < copy.length; i++) {
                let e = copy[i];
                let r = this.records
                    .getAll()
                    .filter(rcd => rcd.event == e) 
                    .find(rcd => rcd.name == undef.name);
                if (!r)
                    path.splice(path.indexOf(e), 1);
            }
            dataChangePaths[undef.name] = { path };
            dataChangePaths[undef.name].rcd = undef;
        });
        return dataChangePaths;
    }

    findDataFlowPaths (dataChangePaths) {
        for (let name in dataChangePaths) {
            let changePath = dataChangePaths[name].path;
            dataChangePaths[name].dataflow = [];
            
            //find dataflow path from source
            changePath.forEach(source => {
                let candidates = 
                    this.records
                            .getAll()
                            //TODO: may use the library happensBefore api
                            .filter(rcd => this.findSuspiciousUse(rcd, name) && 
                                this.rg._happensBeforeWithGraphLib(source, rcd.event) &&
                                changePath.indexOf(rcd.event) == -1)
                            .map(rcd => rcd.event);
                candidates = unique(candidates);
                let paths = this.rg.getPaths(source, candidates);
                dataChangePaths[name].dataflow = [...dataChangePaths[name].dataflow, ...paths];
            });
        }
        return dataChangePaths;
    }

    analyze () {
        //TODO: just store the suspicious use record
        let dataChangePaths = this.findDataChangePaths();
        dataChangePaths = this.findDataFlowPaths(dataChangePaths);
        for (let name in dataChangePaths) {
            let usePaths = dataChangePaths[name].dataflow;
            let changePath = dataChangePaths[name].path;
            let suspicious_use = [];
            for (let path of usePaths) {
                //the head of the usepath can be the head of
                //changepath, so we ignore the shared head
                for (let use_e of path) {
                    if (changePath.indexOf(use_e) > -1) 
                        continue;
                    let rcd = this.records
                                    .getAll()
                                    //TODO: find or filter?
                                    .find(rcd => this.findSuspiciousUse(rcd, name) &&
                                        rcd.event == use_e);
                    suspicious_use.push(rcd);
                }
            }
            dataChangePaths[name].suspicious_use = suspicious_use;
        }
        return dataChangePaths;
    }

    findSuspiciousUse (rcd, name) {
        return rcd.name == name && 
            (rcd.entryType != 'WRITE' || rcd.entryType != 'PUTFIELD');
    }
}

function unique (arr) {
    return Array.from(new Set(arr))
}

module.exports = DataFlowAnalyzer;