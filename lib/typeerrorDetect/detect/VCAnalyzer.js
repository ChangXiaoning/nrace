const path = require('path');
const fs = require('fs');

const graphUtil = require('../hb/util');
var VectorClock = require('./VectorClock');
var MultiLayerMap = require('./MultiLayerMap');
const logger = require('../../../driver/logger.js').logger;

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
        this.fs_reports = [];
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

        this.vcs = {}; //map[eid] = vc
    }

    findOrCreateVC (eid) {
        var result = this.findVC(eid);
        if (result) return result;
        else {
            let t = new VectorClock(this.task_num);
            return t;
        }
    }

    findVC (eid) {
        return this.vcs[eid] ? this.vcs[eid] : null;
    }

    analysis () {
        this.buildVCs();
        this.visualizeVCs();
    }

    buildVCs () {
        let events = this.asyncObjects.getAll();

        for (let i = 0; i < events.length; i++) {
            let ei = events[i].id
            //console.log('buildVCs: ei ', ei);
            let hbevents = [];
            for (let j = 0; j < i; j++) {
                let ej = events[j].id;
                //console.log('buildVCs: ei, ej ', ei, ej);
                if (this.relations.has(ej, ei)) hbevents.push(ej);
            }
            this.createVC(hbevents, ei);
        }
    }

    //Create a vector clock based on hb edges
    createVC (hbevents, e) {
        //TODO: fix bug: if hbevents.length = 0, create a basic vc
        if (hbevents.length == 0) return;
        let vcs = [];
        hbevents.forEach(event => {
            let vc = this.findOrCreateVC(event);
            if (!vc) {
                logger.debug('createVC: missing vc');
                return;
            }
            vcs.push(vc);
        });
        let vc = VectorClock.inct(vcs, this.task_num);
        this.vcs[e] = vc;
    }

    isHB (e1, e2) {
        let vc1 = this.findVC(e1);
        let vc2 = this.findVC(e2);
        
        return VectorClock.compare(vc1, vc2) ? true : false;
    }

    extractType (op) {
        if (op.id) return 'async';
        else return 'sync';
    }

    isOpHB (op1, op2) {
        let e1 = op1.event;
        let e2 = op2.event;
        let type1 = this.extractType(op1);
        let type2 = this.extractType(op2);
        //case-1: event(op1) happens-before event(op2)
        //i.e., event-event race, asyncTask-asyncTask race
        if (type1 == type2) {
            if (op1.event == op2.event) return op1.lineno < op2.lineno;
            else return this.isHB(op1.event, op2.event);
        } else {
        //case-2: NOT (event(op1) delegates event(op2) and op1 happens
        //after delegating op)
            //suppose op2 is the async task op
            if (type1 == 'async') {
                let t = op1;
                op1 = op2;
                op2 = t;
            }
            if (op1.event == op2.register) {
                if (op2.lineno < op1.lineno) return true;
                else return false;
            } else return this.isHB(op1.event, op2.event);
        }
    }

    visualizeVCs () {
        var vcfile = path.resolve(this.appPath, './vc.json');
        //console.log(vcfile);
        var flatten_vcs = {};
        for (let e in this.vcs) {
            flatten_vcs[e] = VectorClock.stringify(this.vcs[e]);
        }
        fs.writeFileSync(vcfile, JSON.stringify(flatten_vcs, null, 4), 'utf-8');
    }

    detect() {
        var keys = varIndexings.keys();
        
        logger.info('Preparing tuples for detecting AV bugs...');
        logger.debug(keys.length+' vars need to be taken care of...');

        for (let i = 0; i < keys.length; i++) {
            list = varIndexings.variables.get(keys[i]);
            logger.debug('Process [ i:0/'+keys.length+', j:0/'+list.length+', k:0/'+list.length+', h:0/'+list.length+', time elapsed:'+(new Date().getTime()-this.time_detect_begin)/1000.0+'s ]');
            logger.debug('['+i+'] start to prepare for var:'+ keys[i],', len:', list.length);
            
            for (let j = 0; j < list.length - 1; j++) {
                for (let k = j + 1; k < list.length; k++) {
                    logger.debug('Process [ i:'+i+'/'+keys.length+', j:'+j+'/'+list.length+', k:'+k+'/'+list.length);
                }
            }
        }
    }

    buildVars () {
        let records = this.records.getAll();
        this.varIndexing = new VariableIndexing();
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
            if (key) this.varIndexing.addDataAccess(key, rcd);
        });
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