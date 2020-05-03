const logger = require('../../../driver/logger.js').logger;

class DataFlowAnalyzer {
    constructor (asyncObjects, records, rg) {
        this.asyncObjects = asyncObjects;
        this.records = records;
        this.rg = rg;

        this.identifyUndefRcd();
    }

    identifyUndefRcd () {
        this.dealWithWrite();

        this.undefRcd = this.records.getAll().filter(rcd => 
            (rcd.entryType == 'WRITE' || rcd.entryType == 'PUTFIELD') && rcd.val == '-2');
        logger.info('length of undef records: %d', this.undefRcd.length);
        
        //take into consider the declare without initialization
        this.dealWithDeclare();
        let declareWithUndef = this.records.getAll()
                                            .filter(rcd => rcd.entryType == "DECLARE" && 
                                                    rcd.val == '-2' && 
                                                    (rcd.initialized == undefined || rcd.initialized == '-2'));
        this.undefRcd = [...this.undefRcd, ...declareWithUndef];
        logger.info('After declare, length of undef records: %d', this.undefRcd.length);
        
        //take into consider the delete operation 
        let deletes = this.records.getAll().filter(rcd => rcd.entryType == "DELETE");
        this.undefRcd = [...this.undefRcd, ... deletes];
        logger.info('After delete, length of undef records: %d', this.undefRcd.length);

        //take into consider the null writing
        let nullWrites = this.records.getAll().filter(rcd =>
            (rcd.entryType == 'WRITE' || rcd.entryType == 'PUTFIELD') && rcd.val == '-3');
        this.undefRcd = [...this.undefRcd, ... nullWrites];
        logger.info('After nullwrites, length of undef records: %d', this.undefRcd.length);
    }

    //there is a writing (also putfield) operation in the same event
    //after undefined/null writting
    dealWithWrite () {
        let writes = this.records.getAll().filter(rcd => 
            (rcd.entryType == 'WRITE' || rcd.entryType == 'PUTFIELD') && 
            (rcd.val == '-2' || rcd.val == '-3'));
        writes.forEach(write => {
            let rcdWithSameName = this.records.getAll().filter(rcd => rcd.name == write.name);
            rcdWithSameName.forEach(r => {
                if ((r.entryType == 'WRITE' || r.entryType == 'PUTFIELD') &&
                    write.event == r.event && write.lineno < r.lineno) {
                    write.val = r.val;
                }
            });
        });
    }

    dealWithDeclare () {
        let varDeclares = this.records.getAll().filter(rcd => rcd.entryType == 'DECLARE' && rcd.val == '-2');
        varDeclares.forEach(declare => {
            let rcdWithSameName = this.records.getAll().filter(rcd => rcd.name == declare.name);
            rcdWithSameName.forEach(r => {
                if ((r.entryType == 'WRITE' || r.entryType == 'PUTFIELD')&& declare.event == r.event && declare.lineno < r.lineno) {
                    declare.initialized = r.val;
                }
            });
        });
    }

    findDataChangePaths () {
        //TODO: we only consider each name with one undefined record 
        let dataChangePaths = {};
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
                dataChangePaths[undef.name] = { path };
                dataChangePaths[undef.name].rcd = undef;
            }
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
                            .filter(rcd => this.findSuspiciousUse(rcd, name) && 
                                this.rg.happensBeforeWithGraphLib(source, rcd.event) &&
                                changePath.indexOf(rcd.event) == -1)
                            .map(rcd => rcd.event);
                candidates = unique(candidates);
                let paths = this.rg.getPaths(source, candidates);
                dataChangePaths[name].dataflow = [...dataChangePaths[name].dataflow, ...paths];
            });
        }
        return dataChangePaths;
    }

    analyze (undefRcds) {
        if (arguments.length != 0) {
            console.log('this is second run');
            this.undefRcd = undefRcds;
        }
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
                    //it is possible that use_e is a intermidate event
                    //on the use path, so use_e may not operate the
                    //variable name
                    if (rcd)
                        suspicious_use.push(rcd);
                }
            }
            dataChangePaths[name].suspicious_use = suspicious_use;
        }
        return dataChangePaths;
    }

    findSuspiciousUse (rcd, name) {
        return rcd.name == name && 
            (rcd.entryType != 'WRITE' && rcd.entryType != 'PUTFIELD' && rcd.entryType != 'DECLARE');
    }
}

function unique (arr) {
    return Array.from(new Set(arr))
}

module.exports = DataFlowAnalyzer;