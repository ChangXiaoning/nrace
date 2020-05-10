const logger = require('../../../driver/logger.js').logger;

class DataFlowAnalyzer {
    constructor (asyncObjects, records, rg) {
        this.asyncObjects = asyncObjects;
        this.records = records;
        this.rg = rg;

        this.undefRcd = null;
        this.runs = 0;
    }

    findDataChangePaths () {
        //Fix: we consider each name with several undefined records 
        let dataChangePaths = {};
        let count = 0;
        this.undefRcd.forEach(undef => {
            let eid = undef.event;
            let root = '1'
            let path = this.rg.getPath(root, eid);
            if (path) {
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

                //deal with the case, in which a name with several
                //undef records
                let key = null;
                /*if (dataChangePaths[undef.name]) {
                    count += 1;
                    key = undef.name + '-' + count; 
                } else {
                    key = undef.name;
                }*/
                //TODO
                key = undef.name;
                dataChangePaths[key] = { path };
                dataChangePaths[key].rcd = undef;
            }
        });
        return dataChangePaths;
    }

    findDataFlowPaths (dataChangePaths) {
        for (let key in dataChangePaths) {
            let changePath = dataChangePaths[key].path;
            dataChangePaths[key].dataflow = [];
            let name = key.split('-')[0];
            
            //find dataflow path from source
            for (let source of changePath) {
                //the source can be the event '1'
                /*if (source == '1')
                    continue;*/
                
                if (dataChangePaths[key].dataflow.length > 0) {
                    let flat = flatten(dataChangePaths[key].dataflow);
                    if (flat.indexOf(source) > -1) 
                        continue;
                }
                
                let candidates = 
                this.records
                        .getAll()
                        .filter(rcd => this.findSuspiciousUse(rcd, name) && 
                            this.rg.happensBeforeWithGraphLib(source, rcd.event) &&
                            changePath.indexOf(rcd.event) == -1)
                        .map(rcd => rcd.event);
                candidates = unique(candidates);
                let paths = this.rg.getPaths(source, candidates);
                dataChangePaths[key].dataflow = [...dataChangePaths[key].dataflow, ...paths];
            };

        }
        return dataChangePaths;
    }

    findSuspiciousUse (rcd, name) {
        return rcd.name == name && 
            (rcd.entryType != 'WRITE' && rcd.entryType != 'PUTFIELD' && rcd.entryType != 'DECLARE'
            //TODO: reason about value?
            //&& rcd.val != '-2' && rcd.val != '-3'
            );
    }

    analyze (undefRcds) {
        this.runs = this.runs + 1;
        this.undefRcd = undefRcds;
        logger.info('No. %d dataflow analysis', this.runs);

        let dataChangePaths = this.findDataChangePaths();
        dataChangePaths = this.findDataFlowPaths(dataChangePaths);
        console.log('back %d', this.runs);
        return dataChangePaths;
    }
}

function unique (arr) {
    return Array.from(new Set(arr))
}

function flatten (arr) {
    return arr.reduce((result, item) => {
        return result.concat(Array.isArray(item)? flatten(item) : item);
    });
}

module.exports = DataFlowAnalyzer;