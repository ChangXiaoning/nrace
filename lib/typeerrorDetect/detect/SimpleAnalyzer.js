const path = require('path');
const fs = require('fs');

const graphUtil = require('../hb/util');
var MultiLayerMap = require('./MultiLayerMap.js').MultiLayerMap;
const logger = require('../../../driver/logger.js').logger;
var FS_RACE_PATTERNS = require('./Config').FS_RACE_PATTERNS;
var VAR_RACE_PATTERNS = require('./Config').VAR_RACE_PATTERNS;
var FP_FILTERS = require('./Config').FP_FILTERS;
var Report = require('./Report').Report;
const BenignChecker = require('./BenignChecker');

const CONDITIONAL_BACKTRACK_NUM = 5;

class Analyzer {
    constructor (appPath) {
        this.appPath = appPath;
        this.hbfile = path.resolve(appPath, './ascii-trace.hb-full.json');
        this.recordfile = path.resolve(appPath, './ascii-trace.access-records.json');
        this.ctxfile = path.resolve(appPath, './ascii-trace.context.json');
        this.ctxchainfile = path.resolve(appPath, './ascii-trace.dyContext-chain.json');
        this.resultfile = path.resolve(appPath, './bug-report.json');
        this.actionsfile = path.resolve(appPath, './ascii-trace.actions.json');
        
        this.init();

        this.reports = [];
    }

    init () {
        let info = graphUtil.read(this.hbfile, this.recordfile, this.ctxfile, this.ctxchainfile, this.actionsfile);

        this.relations = info.relations;
        this.records = info.records;
        this.asyncObjects = info.asyncObjects;
        this.contexts = info.contexts;
        this.contextchain = info.contextchain;
        this.actions = info.actions;
        this.task_num = this.asyncObjects.getAll().length;

        this.varIndexing = new VariableIndexing();
        this.benignChecker = new BenignChecker(this.asyncObjects, this.records, this.appPath, CONDITIONAL_BACKTRACK_NUM, this.relations);
    }

    analysis () {
        this.buildVars();
        this.detect();
        this.filterOutDuplicateReport();
        this.benignChecker.analysis(this.reports);
        this.printReports();
    }

    //Input: node1 and node2: id
    isHB (node1, node2) {
        //if (node1 == '*A*462' && node2 == '*A*487')
        //console.log('isHB: %s, %s', node1, node2);
        if (node1 == node2) return false;
        let e1 = this.asyncObjects.getByAsyncId(node1)[0];
        let e2 = this.asyncObjects.getByAsyncId(node2)[0];
        if (!e1.id.startsWith('*A*') && !e2.id.startsWith('*A*')) {
            //event vs. event
            if (e1.startOp.lineno > e2.startOp.lineno) return false;
        }
        return this.relations.happensBefore(node1, node2);
    }

    extractType (op) {
        if (op.isAsync) return 'async';
        else return 'sync';
    }

    //Input: op1 and op2: object
    isOpHB (op1, op2) {
        let e1 = op1.event;
        let e2 = op2.event;
        let type1 = this.extractType(op1);
        let type2 = this.extractType(op2);

        if (type1 == type2) {
            //Case-1: event-event race
            if (type2 == 'sync') {
                if (op1.event == op2.event) return op1.lineno < op2.lineno;
                else return this.isHB(op1.event, op2.event);
            } else return this.isHB(op1.id, op2.id); //Case-2:asyncTask-asyncTask race
        } else {
            //Case-3: event-asyncTask race
            //suppose op2 is the async task op
            if (type1 == 'async') {
                let t = op1;
                op1 = op2;
                op2 = t;
            }
            if (op1.event == op2.event) {
                if (op1.lineno < op2.lineno) return true;
                else return false;
            } else return this.isHB(op1.event, op2.event);
        }
    }

    isOpConcurrent (op1, op2) {
        return !this.isOpHB(op1, op2) && !this.isOpHB(op2, op1);
    }

    detect() {
        var me = this;
        var keys = this.varIndexing.keys();
        var rcd1, rcd2;
        var patterns = [VAR_RACE_PATTERNS, FS_RACE_PATTERNS];
        
        logger.info('Preparing tuples for detecting bugs...');
        logger.debug(keys.length+' vars need to be taken care of...');

        for (let i = 0; i < keys.length; i++) {
            let list = me.varIndexing.variables.get(keys[i]);
            logger.debug('Process [ i:0/'+keys.length+', j:0/'+list.length+', k:0/'+list.length+', h:0/'+list.length+', time elapsed:'+(new Date().getTime()-this.time_detect_begin)/1000.0+'s ]');
            logger.debug('['+i+'] start to prepare for var:'+ keys[i],', len:', list.length);
            
            for (let j = 0; j < list.length - 1; j++) {
                for (let k = j + 1; k < list.length; k++) {
                    logger.debug('Process [ i:'+i+'/'+keys.length+', j:'+j+'/'+list.length+', k:'+k+'/'+list.length);
                    rcd1 = list[j];
                    rcd2 = list[k];
                    //console.log(rcd1.lineno, rcd2.lineno);
                    //if ([187, 266].indexOf(rcd1.lineno) > -1 || [462, 487].indexOf(rcd2.lineno) > -1)
                        //console.log('debug');
                    for (let type in patterns) {
                        let patternset = patterns[type];
                        for (let ptnName in patternset) {
                            let ptn = patternset[ptnName];
                            if (ptn(rcd1, rcd2)) {
                                if (this.isOpConcurrent(rcd1, rcd2)) {
                                    let rpt = new Report(ptnName, rcd1, rcd2);
                                    for (let key in FP_FILTERS) {
                                        let filter = FP_FILTERS[key];
                                        if (filter(rpt)) {
                                            me.reports.push(rpt);
                                            break;
                                        }
                                    }
                                }
                            }
                        }   
                    }
                }
            }
        }
    }

    buildVars () {
        let records = this.records.getAll();
        let me = this;

        records.forEach(rcd => {
            let entryType = rcd.entryType;
            let key = null;
            switch (entryType) {
                case 'READ':
                case 'WRITE':
                    key = [rcd.ref, rcd.name];
                    break;
                case 'GETFIELD':
                case 'PUTFIELD':
                    key = [rcd.name, rcd.prop];
                    break;
            }
            if (rcd.isAsync) key = ['file', rcd.resource];
            if (key) me.varIndexing.addDataAccess(key, rcd);
        });

        //Process asyncTasks
        for (let action of this.actions) {
            let key = ['file', action.resource];
            me.varIndexing.addDataAccess(key, action);
        }
    }

    filterOutDuplicateReport () {
        let res = [];

        for (let i = 0; i < this.reports.length; i++) {
            let report = this.reports[i];
            let saved = null;
            for (let j = 0; j < res.length; j++) {
                let _rpt = res[j];
                if (Report.equals(report, _rpt)) {
                    saved = _rpt;
                    break;
                }
            }
            if (saved)
                saved.equivalent.push(report.tuple);
            else
                res.push(report);
        }
        this.reports = res;
    }

    printReports () {
        let benignRaces = this.reports.filter(rpt => rpt.benignInfo);
        let harmfulRaces = this.reports.filter(rpt => !rpt.benignInfo);
        
        let info = '\n*** BUG REPORTS ***\n';
        info += 'Count of undefined bugs found: ' + harmfulRaces.length + '\n';
        let count = 0;
        let reports = this.reports;
        let me = this;
        
        for (let rpt of harmfulRaces) {
            count++;
            info += '[' + count + ']' + Report.toString(rpt) + '\n';
        }
        
        info += '\n*** BENIGN BUG REPORTS ***\n';
        count = 0;
        for (let rpt of benignRaces) {
            count++;
            info += '[' + count + ']' + Report.toString(rpt) + '\n';
        }

        console.log(info);

        //write bug reports to file
        if(fs.existsSync(this.resultfile)){
            let newname = this.resultfile.replace('.json', '-bak-'+new Date().toString()+'.json')
            fs.renameSync(this.resultfile, newname);
        }
        fs.writeFileSync(this.resultfile, info, 'utf-8');
    }
}

function VariableIndexing() {
    this.variables = new MultiLayerMap();

}
VariableIndexing.prototype.addDataAccess = function(key, value) {
    var list = this.variables.get(key);
    if (list == MultiLayerMap.NOT_EXIST) {
        list = [];
    }
    try {
        list.push(value);
    } catch (e) {
        logger.error(e);
    }
    this.variables.set(key, list);
}
VariableIndexing.prototype.getDataAccess = function(key) {
    this.variables.get(key);
}

VariableIndexing.prototype.filterOut = function(filterOutFun) {
    if (filterOutFun && typeof filterOutFun == 'function') {
        var keys = this.keys();
        var count = 0;
        logger.info('Begin cleaning data access records: Deleting a variable access information if it is accessed less than 3 times');
        for (var i = 0; i < keys.length; i++) {
            var _var = this.variables.get(keys[i]);
            if (_var != MultiLayerMap.NOT_EXIST && filterOutFun(_var, keys[i])) {
                logger.debug('remove access to variable ', keys[i]);
                this.variables.delete(keys[i]);
                count++;
            }
        }
        logger.info('End cleaning data access records:', count + ' records are removed.');
    }
}

VariableIndexing.prototype.keys = function() {
    return this.variables.keyArray(2);
}


module.exports = Analyzer;