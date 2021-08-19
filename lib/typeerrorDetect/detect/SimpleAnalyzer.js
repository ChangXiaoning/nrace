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

var hb_check = 0;
var chc = 0;

class Analyzer {
    constructor (appPath) {
        this.appPath = appPath;
        //this.hbfile = path.resolve(appPath, './ascii-trace.hb-full.json');
        this.hbfile = path.resolve(appPath, './ascii-trace.newhb.json');
        this.recordfile = path.resolve(appPath, './ascii-trace.access-records.json');
        //this.ctxfile = path.resolve(appPath, './ascii-trace.context.json');
        this.ctxchainfile = path.resolve(appPath, './ascii-trace.dyContext-chain.json');
        this.resultfile = path.resolve(appPath, './newbug-report.json');
        this.actionsfile = path.resolve(appPath, './ascii-trace.actions.json');
        
        //console.log(this.hbfile, this.recordfile, this.actionsfile);
        this.init();

        this.reports = [];
    }

    init () {
        let info = graphUtil.read(this.hbfile, this.recordfile, this.actionsfile);

        this.relations = info.relations;
        this.records = info.records;
        this.asyncObjects = info.asyncObjects;;
        this.actions = info.actions;
        this.task_num = this.asyncObjects.getAll().length;

        this.varIndexing = new VariableIndexing();
        this.benignChecker = new BenignChecker(this.asyncObjects, this.records, this.appPath, CONDITIONAL_BACKTRACK_NUM, this.relations);
    }

    analysis () {
        this.buildVars();
        this._detect();
        console.log('hb_check: %d', this.relations.hb_check);
        console.log('call: %d, iteration: %d', this.relations.hb_call, this.relations.iteration);
        console.log('chc: %d', chc);
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
        //console.log('e1.id: %s, e2.id: %s', e1, e2);
        if (!e1.id.startsWith('*A*') && !e2.id.startsWith('*A*')) {
            //event vs. event
            if (e1.startOp.lineno > e2.startOp.lineno) return false;
        }
        hb_check++;
        var t = this.relations.happensBefore(node1, node2);
        //console.log('isHB: %s, %s, %s', node1, node2, t);
        return t;
        //return this.relations._happensBefore(node1, node2);
    }

    extractType (op) {
        if (op.isAsync == '1') return 'async';
        else return 'sync';
    }

    //Input: op1 and op2: object
    isOpHB (op1, op2) {
        let e1 = op1.event;
        let e2 = op2.event;
        let type1 = this.extractType(op1);
        let type2 = this.extractType(op2);

        //console.log('isOpHB: %s, %s', op1.id, op2.id);
        if (type1 == type2) {
            //Case-1: event-event race
            if (type2 == 'sync') {
                if (op1.event == op2.event) return op1.lineno < op2.lineno;
                //else return this.relations.isEventHB(op1.event, op2.event);
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

        /*let file_var_cnt = 0;
        for (let i = 0; i < keys.length; i++) {
            if (keys[i].indexOf('file') == 0) file_var_cnt++;
        }
        logger.debug(file_var_cnt+ ' file vars need to be taken care of...')*/

        for (let i = 0; i < keys.length; i++) {
            //if (keys[i].indexOf('file') == 0) continue;
            let list = me.varIndexing.variables.get(keys[i]);
            logger.debug('Process [ i:0/'+keys.length+', j:0/'+list.length+', k:0/'+list.length+', h:0/'+list.length+', time elapsed:'+(new Date().getTime()-this.time_detect_begin)/1000.0+'s ]');
            logger.debug('['+i+'] start to prepare for var:'+ keys[i],', len:', list.length);
            
            for (let j = 0; j < list.length - 1; j++) {
                for (let k = j + 1; k < list.length; k++) {
                    logger.debug('Process [ i:'+i+'/'+keys.length+', j:'+j+'/'+list.length+', k:'+k+'/'+list.length);
                    rcd1 = list[j];
                    rcd2 = list[k];
                    //console.log(rcd1.lineno, rcd2.lineno);
                    if ([3662].indexOf(rcd1.lineno) > -1 || [3662].indexOf(rcd2.lineno) > -1)
                        console.log('debug');
                    for (let type in patterns) {
                        let patternset = patterns[type];
                        for (let ptnName in patternset) {
                            let ptn = patternset[ptnName];
                            if (ptn(rcd1, rcd2)) {
                                chc++;
                                if (this.isOpConcurrent(rcd1, rcd2)) {
                                    let rpt = new Report(ptnName, rcd1, rcd2);
                                    let pass = 0;
                                    for (let key in FP_FILTERS) {
                                        let filter = FP_FILTERS[key];
                                        let filterResult = filter(rpt);
                                        if (filterResult) pass++;
                                        if (pass == 4) me.reports.push(rpt);
                                    }
                                    pass = 0;
                                }
                            }
                        }   
                    }
                }
            }
        }
    }

    /**Detection based on chains */
    _detect () {
        var me = this;
        var keys = this.varIndexing.keys();
        var rcd1, rcd2;
        var patterns = [VAR_RACE_PATTERNS, FS_RACE_PATTERNS];
        
        logger.info('Preparing tuples for detecting bugs...');
        logger.debug(keys.length+' vars need to be taken care of...');

        /*let file_var_cnt = 0;
        for (let i = 0; i < keys.length; i++) {
            if (keys[i].indexOf('file') == 0) file_var_cnt++;
        }
        logger.debug(file_var_cnt+ ' file vars need to be taken care of...')*/

        for (let i = 0; i < keys.length; i++) {
            //if (keys[i].indexOf('file') == 0) continue;
            //if (keys[i].indexOf('/tmp/TEST_anyUser') != -1)
                //console.log('debug');
            let list = me.varIndexing.variables.get(keys[i]);
            logger.debug('Process [ i:0/'+keys.length+', j:0/'+list.length+', k:0/'+list.length+', h:0/'+list.length+', time elapsed:'+(new Date().getTime()-this.time_detect_begin)/1000.0+'s ]');
            logger.debug('['+i+'] start to prepare for var:'+ keys[i],', len:', list.length);

            //collect chains
            let chains = {};
            for (let j = 0; j < list.length; j++) {
                let rcd = list[j];
                let eid = rcd.event;
                let cid = this.relations.getChainId(eid);
                if (cid) {
                    if (!chains[cid]) chains[cid] = [];
                    chains[cid].push(rcd);
                }
            }

            //detect races among chains
            let cids = Object.keys(chains);
            let rcd1 = null, rcd2 = null;
            for (let k = 0; k < cids.length - 1; k++) {
                let k_chain = chains[cids[k]]
                for (let h = k + 1; h < cids.length; h++) {
                    let h_chain = chains[cids[h]];
                    for (let m = 0; m < k_chain.length; m++) {
                        rcd1 = k_chain[m];
                        let hb_flag = false;
                        for (let n = 0; n < h_chain.length && !hb_flag; n++){
                            rcd2 = h_chain[n];
                            //console.log('_detect: rcd1: %s, rcd2: %s', rcd1.lineno, rcd2.lineno);
                            //suppose rcd1 occurs before rcd2 in trace
                            if (rcd1.lineno > rcd2.lineno) {
                                let t = rcd1;
                                rcd1 = rcd2;
                                rcd2 = t;
                            }
                            let patternset = null;
                            if (keys[i].indexOf('file') == -1) patternset = VAR_RACE_PATTERNS;
                            else patternset = FS_RACE_PATTERNS;
                            for (let ptnName in patternset) {
                                let ptn = patternset[ptnName];
                                if (ptn(rcd1, rcd2)) {
                                    chc++;
                                    let hb_result = this.isOpHB(rcd1, rcd2);
                                    if (hb_result) {
                                        hb_flag = true;
                                        break;
                                    } else {
                                        let rpt = new Report(ptnName, rcd1, rcd2);
                                        let pass = 0;
                                        for (let key in FP_FILTERS) {
                                            let filter = FP_FILTERS[key];
                                            let filterResult = filter(rpt);
                                            if (filterResult) pass++;
                                            if (pass == 4) me.reports.push(rpt);
                                        }
                                        pass = 0;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /**Detection based on chains & indexed by events */
    __detect () {
        var me = this;
        var keys = this.varIndexing.keys();
        var rcd1, rcd2;
        var patterns = [VAR_RACE_PATTERNS/*, FS_RACE_PATTERNS*/];
        var conflictPairIndex = new VariableIndexing();
        var conflict_cnt = 0;
        
        logger.info('Preparing tuples for detecting bugs...');
        logger.debug(keys.length+' vars need to be taken care of...');

        /*let file_var_cnt = 0;
        for (let i = 0; i < keys.length; i++) {
            if (keys[i].indexOf('file') == 0) file_var_cnt++;
        }
        logger.debug(file_var_cnt+ ' file vars need to be taken care of...')*/

        //categorize conflicting pairs by events
        for (let i = 0; i < keys.length; i++) {
            if (keys[i].indexOf('file') == 0) continue;
            let list = me.varIndexing.variables.get(keys[i]);
            logger.debug('Process [ i:0/'+keys.length+', j:0/'+list.length+', k:0/'+list.length+', h:0/'+list.length+', time elapsed:'+(new Date().getTime()-this.time_detect_begin)/1000.0+'s ]');
            logger.debug('['+i+'] start to prepare for var:'+ keys[i],', len:', list.length);
            //console.log('key: ', key[i]);
            
            for (let j = 0; j < list.length - 1; j++) {
                for (let k = j + 1; k < list.length; k++) {
                    logger.debug('Process [ i:'+i+'/'+keys.length+', j:'+j+'/'+list.length+', k:'+k+'/'+list.length);
                    rcd1 = list[j];
                    rcd2 = list[k];
                    let key = null;
                    //console.log(rcd1.lineno, rcd2.lineno);
                    //if ([6402, 7691].indexOf(rcd1.lineno) > -1 && [6402, 7691].indexOf(rcd2.lineno) > -1)
                        //console.log('debug');
                    for (let type in patterns) {
                        let patternset = patterns[type];
                        for (let ptnName in patternset) {
                            let ptn = patternset[ptnName];
                            if (ptn(rcd1, rcd2)) {
                                //chc++;
                                conflict_cnt++;
                                let eid1 = rcd1.event;
                                let eid2 = rcd2.event;
                                if (eid1 == eid2) continue;
                                let e1 = this.asyncObjects.getByAsyncId(eid1)[0];
                                let e2 = this.asyncObjects.getByAsyncId(eid2)[0];
                                key = e1.startOp.lineno < e2.startOp.lineno ? [eid1, eid2] : [eid2, eid1];
                            }
                        }   
                    }
                    if (key) conflictPairIndex.addDataAccess(key, [rcd1.lineno, rcd2.lineno]);
                }
            }
        }

        console.log('conflict_cnt: %d', conflict_cnt);

        //process conflicting events
        /*var eventPairs = conflictPairIndex.keys();
        var eventPairDict = {};
        let records = this.records.getAll();
        for (let evPair of eventPairs) {
            let e1 = evPair[0];
            let e2 = evPair[1];
            eventPairDict[e1] = eventPairDict[e1] ? eventPairDict[e1] : [];
            eventPairDict[e1].push(e2);
            if (!this.isHB(e1, e2)) {
                let list = conflictPairIndex.variables.get(evPair);
                for (let conflictRcdPair of list) {
                    let rcd1 = records.find(r => r.lineno == conflictRcdPair[0]);
                    let rcd2 = records.find(r => r.lineno == conflictRcdPair[1]);
                    if (rcd1 && rcd2) {
                        let rpt = new Report('', rcd1, rcd2);
                        let pass = 0;
                        for (let key in FP_FILTERS) {
                            let filter = FP_FILTERS[key];
                            let filterResult = filter(rpt);
                            if (filterResult) pass++;
                            if (pass == 4) me.reports.push(rpt);
                        }
                        pass = 0;
                    }
                }
            }
        }*/


    }

    buildVars () {
        let records = this.records.getAll();
        let me = this;

        //console.log('rcd.length: %d', records.length);

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
                case 'DELETE':
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
        /*if(fs.existsSync(this.resultfile)){
            let newname = this.resultfile.replace('.json', '-bak-'+new Date().toString()+'.json')
            fs.renameSync(this.resultfile, newname);
        }
        fs.writeFileSync(this.resultfile, info, 'utf-8');*/
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