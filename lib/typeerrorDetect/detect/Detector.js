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
        
        this.detectBasicCase();
        this.detectByDataFlow();
        
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
            /*
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
            });*/
        });
    }

    detectByDataFlow () {
        logger.info('Start to detect dataflow case races ...');
        this.dataflowanalyzer = new DataFlowAnalyzer(this.asyncObjects, this.records, this.rg);
        let suspicious_uses = this.dataflowanalyzer.analyze();
        this.printSuspiciousUses(suspicious_uses);
    }

    printSuspiciousUses (uses) {
        let info = '\n*** SUSPICIOUS USE ***\n';
        info += 'Count of suspicious uses found: ' + uses.length + '\n';
        let count = 0;
        uses.forEach(use => {
            count++;
            info += '[' + count + ']' + printRecord(use) + '\n';
        })
        logger.warn(info);
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