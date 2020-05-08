const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const logger = require('../../../driver/logger.js').logger;
const graphUtil = require('../hb/util');
const DataFlowAnalyzer = require('./DataFlowAnalyzer');

class Detector {

    constructor (appPath) {
        this.hbfile = path.resolve(appPath, './ascii-trace.hb.json');
        this.recordfile = path.resolve(appPath, './ascii-trace.access-records.json');
        this.reports = [];
        this.resultfile = path.resolve(appPath, './bug-report.json');

        this.init();
    }

    init () {
        let info = graphUtil.read(this.hbfile, this.recordfile);
        this.rg = info.relations;
        this.records = info.records;
        logger.info('length of records: %d', this.records.getAll().length);

        this.rg.startGraphLibDataStructure();
    }

    detect (cb) {
        logger.info('Start to detect races ...');
        
        //this.detectBasicCase();
        //this.detectByDataFlow();
        this._detect();
        this.filter();
        
        this.printReports();
        cb(this.reports);
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
        this.dataflowanalyzer = new DataFlowAnalyzer(this.asyncObjects, this.records, this.rg);
        let dataChangePaths = this.dataflowanalyzer.analyze();
        this.propagateUndef = {};
        for (let key in dataChangePaths) {
            let name = key.split('-')[0];
            let suspicious_uses = dataChangePaths[key].suspicious_use;
            let undef = dataChangePaths[key].rcd;
            //Basic cases: undefined operation race with suspicious
            //use
            //TODO: only consider write undefined
            //this.printRecords('suspicious use', suspicious_uses);
            logger.warn('undef record:');
            console.log(printRecord(undef));
            suspicious_uses.forEach(use => {
                if (this.rg.isOpConcur(use, undef)) {
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

        for (let name in this.propagateUndef) {
            //this.printRecords('undef assignment', this.propagateUndef[name]);
            
            let dataChangePaths = this.dataflowanalyzer.analyze(this.propagateUndef[name]);
           
            for (let key in dataChangePaths) {
                let name = key.split('-')[0];
                let suspicious_uses = dataChangePaths[key].suspicious_use;
                let undef = dataChangePaths[key].rcd;
                //Basic cases: undefined operation race with suspicious
                //use
                //TODO: only consider write undefined
                //this.printRecords('suspicious use', suspicious_uses);
                suspicious_uses.forEach(use => {
                    if (this.rg.isOpConcur(use, undef)) {
                        this.reports.push(new Report(undef, use, true));
                    }
                });
            }
        }
    }

    filter () {
        let res = [];
        for (let i = 0; i < this.reports.length; i++) {
            let rpt_i = this.reports[i];
            let saved = null;
            for (let j = 0; j < res.length; j++) {
                let rpt_j = res[j];
                if (rpt_j.equals(rpt_i)) {
                    saved = rpt_j;
                    break;
                }
            }

            if (!saved)
                res.push(rpt_i);
        }

        this.reports = res;
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

        //write bug reports to file
        if(fs.existsSync(this.resultfile)){
            let newname = this.resultfile.replace('.json', '-bak-'+new Date().toString()+'.json')
            fs.renameSync(this.resultfile, newname);
        }
        fs.writeFileSync(this.resultfile, info, 'utf-8');
    }
}

function printRecord (rcd) {
    return printObj(rcd, ['name', 'entryType', 'event', 'iid', 'location', 'lineno', 'val']);
}

class Report {
    constructor (undef, use, isPropagate) {
        this.tuple = [undef, use];
        this.name = undef.name;
        this.ptn = undef.entryType + ' vs. ' + use.entryType;
        this.iid = undef.iid + ' vs. ' + use.iid;
        this.location = undef.location + ' vs. ' + use.location;
        this.footprint = undef.cbLoc + ' vs. ' + use.cbLoc;
        this.isPropagate = isPropagate ? true : false;
    }

    toString () {
        let res = this.footprint + ':' + this.ptn + '\n';
        this.tuple.forEach(rcd => {
            res += printObj(rcd, ['name', 'entryType', 'event', 'iid', 'location', 'lineno', 'val']);
            res += '\n';
        });
        res += this.isPropagate.toString() + '\n';
        return res;
    }

    equals (other) {
        if (!other)
            return false;
        else
            return this.footprint == other.footprint;
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