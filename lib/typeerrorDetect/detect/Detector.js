const fs = require('fs');
const _ = require('lodash');

const logger = require('../../../driver/logger.js').logger;
const DataFlowAnalyzer = require('./DataFlowAnalyzer');

class Detector {
    constructor (traceFile) {
        this.traceFile = traceFile;
        let recordFileName = traceFile.replace('.hb-full.json', '.access-records.json')
        let hbFileName = traceFile.replace('.log', '.hb-full.json');
        this.recordFileName = fs.existsSync(recordFileName) && fs.lstatSync(recordFileName).isFile()? recordFileName : null;
        this.hbFileName = fs.existsSync(hbFileName) && fs.lstatSync(hbFileName).isFile()? hbFileName : null;
        this.reports = [];
    }

    init (results) {
        this.asyncObjects = results.asyncObjects;
        this.records = results.records;
        //TODO: use the graphlib and reduced graph
        this.hbGraph = results.hbGraph;
        this.rg = results.rg;

        this.dealWithDeclare(this.records.getAll());
        this.varRcds = this.classifyRecords(this.records.getAll());
    }

    classifyRecords (records) {
        var ret = {};
        records.forEach(rcd => {
            let name = rcd.name;
            ret[name] = ret[name] == undefined? new Array() : ret[name];
            ret[name].push(rcd);
        });
        return ret;
    }

    dealWithDeclare (records) {
        let varDeclares = records.filter(rcd => rcd.entryType == 'DECLARE' && rcd.val == '-2');
        varDeclares.forEach(declare => {
            let rcdWithSameName = records.filter(rcd => rcd.name == declare.name);
            rcdWithSameName.forEach(r => {
                //TODO: only write but also putfield.
                if (r.entryType == 'WRITE' && declare.event == r.event && declare.lineno < r.lineno) {
                    declare.initialized = r.val;
                }
            });
        });
    }

    detect (cb) {
        logger.info('Start to detect races ...');
        
        //this.detectBasicCase();
        //this.detectByDataFlow();
        this._detect();
        
        this.printReports();
        cb(this.reports);
    }

    detectBasicCase () {
        logger.info('Start to detect basic case races ...');
        Object.keys(this.varRcds).forEach(name => {
            //Pattern 1: write undefined race with uses
            let rcds = this.varRcds[name];
            let undefs = rcds.filter(rcd => rcd.entryType == 'WRITE' && rcd.val == '-2');
            let uses = rcds.filter(rcd => rcd.val != undefined);
            undefs.forEach(undef => {
                uses.forEach(use => {
                    if (this.hbGraph.isOpConcur(undef, use)) {
                        this.reports.push(new Report(undef, use));
                    }
                })
            })
            
            //Pattern 2: declare without initialization races with
            //uses
            let uninitializedDeclares = rcds.filter(rcd => rcd.entryType == "DECLARE" && rcd.val == '-2' && (rcd.initialized == undefined || rcd.initialized == '-2'));
            uninitializedDeclares.forEach(uninit => {
                uses.forEach(use => {
                    if (this.hbGraph.isOpConcur(uninit, use)) {
                        this.reports.push(new Report(uninit, use));
                    }
                });
            });

            //Pattern 3: delete races with uses
            let deletes = rcds.filter(rcd => rcd.entryType == "DELETE");
            deletes.forEach(del => {
                uses.forEach(use => {
                    if (this.hbGraph.isOpConcur(del, use)) {
                        this.reports.push(new Report(del, use));
                    }
                });
            });
        });
    }

    detectByDataFlow () {
        logger.info('Start to detect dataflow case races ...');
        this.dataflowanalyzer = new DataFlowAnalyzer(this.asyncObjects, this.records, this.rg);
        let suspicious_uses = this.dataflowanalyzer.analyze();
        this.printRecords('suspicious use', suspicious_uses);
        let undefAssignments = this.detectUndefAssignment(suspicious_uses);
        this.printRecords('undef assignment', undefAssignments);
    }

    detectUndefAssignment (suspicious_uses) {
        let ret = [];
        suspicious_uses.forEach(use => {
            let assign = this.records.getAll().find(rcd => rcd.lineno == use.lineno + 1);
            if (assign) {
                if (assign.val == use.val) {
                    ret.push(assign);
                }
            } 
        });
        return ret;
    }

    printRecords (title, records) {
        let info = '\n*** ' + title.toUpperCase() + ' ***\n';
        info += 'Count of ' + title + ' found: ' + records.length + '\n';
        let count = 0;
        records.forEach(rcd => {
            count++;
            info += '[' + count + ']' + printRecord(rcd) + '\n';
        });
        logger.warn(info);
    }

    _detect () {
        logger.info('Start to detect dataflow case races ...');
        this.dataflowanalyzer = new DataFlowAnalyzer(this.asyncObjects, this.records, this.rg);
        let dataChangePaths = this.dataflowanalyzer.analyze();
        this.propagateUndef = {};
        for (let name in dataChangePaths) {
            let suspicious_uses = dataChangePaths[name].suspicious_use;
            let undef = dataChangePaths[name].rcd;
            //Basic cases: undefined operation race with suspicious
            //use
            //TODO: only consider write undefined
            this.printRecords('suspicious use', suspicious_uses);
            suspicious_uses.forEach(use => {
                if (this.hbGraph.isOpConcur(use, undef)) {
                    this.reports.push(new Report(undef, use));
                }

                //Propagate undefined to other value
                let assign = this.records.getAll().find(rcd => rcd.lineno == use.lineno + 1);
                if (assign) {
                    if (assign.val == use.val) {
                        this.propagateUndef[assign.name] = this.propagateUndef[assign.name]? this.propagateUndef[assign.name]: new Array();
                        this.propagateUndef[assign.name].push(assign);
                    }
                }
            });
        }
        for (let name in this.propagateUndef)
            this.printRecords('undef assignment', this.propagateUndef[name]);
    }

    printReports () {
        let info = '\n*** BUG REPORTS ***\n';
        info += 'Count of undefined bugs found: ' + this.reports.length + '\n';
        let count = 0;
        this.reports.forEach(report => {
            count++;
            info += '[' + count + ']' + report.toString() + '\n';
        });
        logger.warn(info);
    }
}

function printRecord (rcd) {
    return printObj(rcd, ['name', 'entryType', 'event', 'iid', 'location', 'lineno']);
}

class Report {
    constructor (undef, use) {
        this.tuple = [undef, use];
        this.name = undef.name;
        this.ptn = undef.entryType + ' vs. ' + use.entryType;
        this.iid = undef.iid + ' vs. ' + use.iid;
        this.location = undef.location + ' vs. ' + use.location;
        this.footprint = undef.cbLoc + ' vs. ' + use.cbLoc;
    }

    toString () {
        let res = this.footprint + ':' + this.ptn + '\n';
        this.tuple.forEach(rcd => {
            //TODO: cbLoc
            res += printObj(rcd, ['lineno', 'location', 'iid', 'entryType', 'name', 'event']);
            res += '\n';
        });
        return res;
    }
}

function printObj (o, fields) {
    let res = [];
    if (o && fields) {
        fields.forEach(field => {
            if (o.hasOwnProperty(field)) {
                res.push(field + ':' +JSON.stringify(o[field]));
            }
        });
    }
    return '{' + res.join(', ') + '}';
}

module.exports = Detector;