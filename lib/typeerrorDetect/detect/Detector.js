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

        this.undefRcd = null;
        this.identifyUndefRcd();
        this.dataflowanalyzer = new DataFlowAnalyzer(this.asyncObjects, this.records, this.rg);
    }

    identifyUndefRcd () {
        this.dealWithWrite();

        this.undefRcd = this.records.getAll().filter(rcd => 
            (rcd.entryType == 'WRITE' || rcd.entryType == 'PUTFIELD') && rcd.val == '-2' && !rcd.isDeclaredLocal);
        logger.info('length of undef records: %d', this.undefRcd.length);
        
        //take into consider the declare without initialization
        this.dealWithDeclare();
        let declareWithUndef = this.records.getAll()
                                            .filter(rcd => rcd.entryType == "DECLARE" && 
                                                    !rcd.isDeclaredLocal &&
                                                    rcd.val == '-2' && 
                                                    (rcd.initialized == undefined || rcd.initialized == '-2'));
        this.undefRcd = [...this.undefRcd, ...declareWithUndef];
        logger.info('After declare, length of undef records: %d', this.undefRcd.length);
        
        //take into consider the delete operation 
        let deletes = this.records.getAll().filter(rcd => rcd.entryType == "DELETE" && !rcd.isDeclaredLocal);
        this.undefRcd = [...this.undefRcd, ... deletes];
        logger.info('After delete, length of undef records: %d', this.undefRcd.length);

        //take into consider the null writing
        let nullWrites = this.records.getAll().filter(rcd =>
            (rcd.entryType == 'WRITE' || rcd.entryType == 'PUTFIELD' && !rcd.isDeclaredLocal) && rcd.val == '-3');
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

    detect (cb) {
        logger.info('Start to detect races ...');
        
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
        //this.dataflowanalyzer = new DataFlowAnalyzer(this.asyncObjects, this.records, this.rg);
        let already = [];
        let isPropagate = false;
        while (this.undefRcd.length > 0) {
            logger.info('length of undef records: %d', this.undefRcd.length);
            let dataChangePaths = this.dataflowanalyzer.analyze(this.undefRcd);
            let todo = [];
            for (let key in dataChangePaths) {
                console.log('key: %s', key);
                let name = key.split('-')[0];
                
                let changePath = dataChangePaths[key].path
                let usePaths = dataChangePaths[key].dataflow;
                let undef = dataChangePaths[key].rcd;
                already.push(undef.lineno);

                let propagateUndef = [];

                for (let path of usePaths) {
                    console.log('path: %s', path);
                        
                    for (let use_e of path) {
                        //the head of the usepath can be the head
                        //of changepath, so we ignore the shared
                        //head
                        if (changePath.indexOf(use_e) > -1) 
                            continue;

                        let use_rcd = this.records
                                        .getAll()
                                        //TODO: find or filter?
                                        .find(rcd => this.findSuspiciousUse(rcd, name) &&
                                            rcd.event == use_e &&
                                            //Not consider local variable
                                            !rcd.isDeclaredLocal);
                        //it is possible that use_e is a intermidate event
                        //on the use path, so use_e may not operate the
                        //variable name
                        if (use_rcd) {
                            //basic case
                            if (this.rg.isOpConcur(use_rcd, undef)) {
                                this.reports.push(new Report(undef, use_rcd, isPropagate));
                            }
                            //Propagate undefined to other value
                            //TODO: the standard to identify
                            //undef assignment is strict?
                            let assign = this.records.getAll().find(rcd => rcd.lineno == use_rcd.lineno + 1);
                            if (assign) {
                                if (assign.val == use_rcd.val) {
                                    //avoid push same records
                                    if (!already.find(lineno => lineno == assign.lineno))
                                        propagateUndef.push(assign);
                                }
                            }
                        }
                    }
                }
                todo = [...todo, ...propagateUndef]; 
                isPropagate = true;
            }
            this.undefRcd = todo;
            //TODO: whether to process undefRcd before dataflow analysis?
        }
    }

    findSuspiciousUse (rcd, name) {
        return rcd.name == name && 
            (rcd.entryType != 'WRITE' && rcd.entryType != 'PUTFIELD' && rcd.entryType != 'DECLARE'
            //TODO: reason about value?
            //&& rcd.val != '-2' && rcd.val != '-3'
            );
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