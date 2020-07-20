const path = require('path');
const fs = require('fs');

const graphUtil = require('../hb/util');
const createObjIdManager = require('./ObjIdManager');
const ConcolicValue = require('./ConcolicValue').ConcolicValue;
const AnnotatedExecution = require('./ConcolicValue').AnnotatedExecution;
const Point2 = require('./Point2');
const preprocess = require('./Preprocessor');
const json = require('@dagrejs/graphlib/lib/json');

const getConcrete =  ConcolicValue.getConcrete;
const getSymbolic = ConcolicValue.getSymbolic;
const  Prefix = '*U*';

class Analyzer {
    constructor (appPath) {
        this.appPath = appPath;
        this.hbfile = path.resolve(appPath, './ascii-trace.hb.json');
        this.recordfile = path.resolve(appPath, './ascii-trace.access-records.json');
        this.ctxfile = path.resolve(appPath, './ascii-trace.context.json');
        this.ctxchainfile = path.resolve(appPath, './ascii-trace.context-chain.json');
        this.resultfile = path.resolve(appPath, './bug-report.json');

        this.idManager = createObjIdManager();

        this.init();

        this.reports = [];
    }

    init () {
        let info = graphUtil.read(this.hbfile, this.recordfile, this.ctxfile, this.ctxchainfile);
        this.rg = info.relations;
        this.records = info.records;
        this.asyncObjects = info.asyncObjects;
        this.contexts = info.contexts;
        this.contextchain = info.contextchain;

        this.rg.startGraphLibDataStructure();
        this.annotatedExecution = new AnnotatedExecution(this.rg, this.contexts, this.contextchain);
        this.point2 = new Point2(this.rg);

        this.current_func_iid = null;
    }

    preprocess () {
        preprocess(this.records.getAll());
    }

    intraEventAnalyze () {
        let events = this.asyncObjects.getAll();
        let me = this;

        for (let event of events) {
            let records = me.records.getAll().filter(rcd => rcd.event == event.id);
            //me.concolicExecution(records);
        }
    }

    imitateExecution () {
        let me = this;
        let records = this.records.getAll();
        this.current_func_iid = new Array();
        for (let record of records) {
            //if (record.isDeclaredLocal) continue;
            let entryType = record.entryType;
            let baseObjId = null;
            let val = record.val;
            let cval = null;
            let e = record.event;
            let isDeclaredLocal = record.isDeclaredLocal? true: false;

            //if (record.entryType == 'DELETE') 
                //console.log('bug');
            //if (['7', '8', '13'].indexOf(record.event) > -1)
               // console.log('bug');
            if (record.lineno == '16714')
                console.log(record.lineno);

            switch (entryType) {
                case 'WRITE':
                case 'READ':
                    if (!(me.annotatedExecution.searchConcolicValue(val, record.valIsObject)))
                        cval = new ConcolicValue(val, record.name, false, record.valIsObject, e, me.annotatedExecution, record.lineno, isDeclaredLocal, me.getCurrentCtxIid());
                    else {
                        cval = me.annotatedExecution.addSymbolic(val, record.name, false, record.valIsObject, e, record.lineno, isDeclaredLocal, me.getCurrentCtxIid(), entryType);
                    }
                    break;
                case 'DELETE':
                case 'PUTFIELD':
                case 'GETFIELD':
                    baseObjId = record.name;
                    //wierd: obj.f == obj//true
                    if (baseObjId != val) {
                        if (!(me.annotatedExecution.searchConcolicValue(val, record.valIsObject)))
                            cval = new ConcolicValue(val, {base: baseObjId, prop: record.prop}, true, record.valIsObject, e, me.annotatedExecution, record.lineno, isDeclaredLocal, me.getCurrentCtxIid());
                        else {
                            //var isDeclaredLocal = record.isDeclaredLocal? true: false;
                            cval = me.annotatedExecution.addSymbolic(val, {base: baseObjId, prop: record.prop}, true, record.valIsObject, e, record.lineno, isDeclaredLocal, me.getCurrentCtxIid(), entryType);
                        }
                    } else {
                        //console.log('ignore: %s', JSON.stringify(record));
                    }
                    break;
                case 'FUNCTION_ENTER':
                case 'SCRIPT_ENTER':
                    this.functionEnter(record);
                    break;
                case 'FUNCTION_EXIT':
                case 'SCRIPT_EXIT':
                    this.functionExit();
                    break;
            }

            //filter out infeasible pointer
            if (cval) {

            }

            if (cval) {
                //reverse analysis: pointer -> obj
                let s_symbolic = me.annotatedExecution.toString(cval.symbolic, false);
                /*for (let s_sym of s_symbolic) {
                    me.point2.addPoint2(s_sym, cval.valIsObject == 'true'? 'obj_' + cval.concrete : 'val_' + cval.concrete);
                }*/
                for (let symbol of cval.symbolic) {
                    let pointerName = me.annotatedExecution.toString(symbol, false)[0];
                    let obj = { concrete: cval.concrete, event: symbol.event, valIsObject: cval.valIsObject, lineno: symbol.lineno };
                    me.point2.addPoint2(pointerName, obj);
                }
            }

            if (cval) {
                var overwrites = me.annotatedExecution.backwardUpdateSymbolic(cval);
                if (overwrites.size > 0) {
                    //console.log('debug: %s', record.lineno);
                    me.point2.removePoint2(overwrites);
                }
            }
            if (cval) {
                record.symbolic = cval.symbolic;
                record.s_symbolic = unique( me.annotatedExecution.toString(record.symbolic, false) );
                //me.detect(record, record.s_symbolic);
                me.detectGeneralRace(record, cval);
            }
        }
    }

    functionEnter (record) {
        this.current_func_iid.push(record.iid);
    }

    functionExit () {
        this.current_func_iid.pop();
    }

    getCurrentCtxIid () {
        return this.current_func_iid[this.current_func_iid.length - 1];
    }

    analysis () {
        this.preprocess();
        this.imitateExecution();

        let values = [{val: '*U*', valIsObject: undefined}];
        let inspectPointers = ['this*_cache*id'];
        //this._visualize(values, inspectPointers);
        //this.visualize();
        this.filterOutDuplicateReport();
        this.printReports();
    }

    visualize () {
        this.annotatedExecution.print();
        this.point2.print();
    }

    _visualize (values, pointers) {
        this.annotatedExecution._print(values);
        this.point2._print(pointers);
    }

    detect (idxRcd, s_symbolic_list) {
        //FP-1: isDeclaredLocal
        if ((idxRcd.isDeclaredLocal))
            return;
        //if (idxRcd.lineno == '665')
            //console.log('detect bug');
        let me = this;
        let objs = [];
        for (let s_symbolic of s_symbolic_list) {
          objs = [...objs, ...me.point2.getPoint2Objects(s_symbolic)];   
        }
        objs = unique(objs);
        if (objs.length >= 2) {
            //console.log('detect: %s', JSON.stringify(idxRcd) + '\n');
            if (this.isUndefinedOrNull(idxRcd)) {
                //pattern1: first access to null/undefined, then
                //access to other values
                var othervalues = objs.filter(o => !(me.isUndefinedOrNull(o)) && o.event != idxRcd.event);
                if (othervalues.length > 0) {
                    //TODO: only report the first not undefined
                    //record.
                    var otherRcd = me.records.getAll().find(rcd => rcd.lineno == othervalues[0].lineno);
                    me.reports.push(new Report(otherRcd, idxRcd, s_symbolic_list, 'ptn1'));
                }
            } else {
                //pattern2: first access to other values then access
                //to null/undefined
                var undefs = objs.filter(o => (me.isUndefinedOrNull(o)) && o.event != idxRcd.event);
                if (undefs.length > 0) {
                    //TODO: only report the first undefined record.
                    let undefRcd = me.records.getAll().find(rcd => rcd.lineno == undefs[0].lineno);
                    me.reports.push(new Report(idxRcd, undefRcd, s_symbolic_list, 'ptn2'))
                }
            }  
        }
    }

    /**
     * Detect general races
     * @param {*} idxRcd 
     * @param {*} cval 
     */
    detectGeneralRace (idxRcd, cval) {
        //FP-1: isDeclaredLocal
        if ((idxRcd.isDeclaredLocal))
            return;
        //if (idxRcd.lineno == '665')
            //console.log('detect bug');
        let lineno = idxRcd.lineno;
        let writeEntryType = ['WRITE', 'PUTFIELD', 'DELETE'];
        let readEntryType = ['READ', 'GUTFIELD'];
        let targetEntryType = writeEntryType.indexOf(idxRcd.entryType) > -1 ? readEntryType : writeEntryType;
        let me = this;
        let s_symbolic_list = idxRcd.s_symbolic;
        let objs = [];
        for (let s_symbolic of s_symbolic_list) {
          objs = [...objs, ...me.point2.getPoint2Objects(s_symbolic)];   
        }
        objs = unique(objs);
        if (objs.length >= 2) {
            let othervalues = objs.filter(o => !me.point2.isObjectEqual(o, cval, false));
            if (othervalues.length > 0) {
                //TODO: use the first value
                for (let value in othervalues) {
                    let otherRcd = me.records.getAll().find(rcd => rcd.lineno == value.lineno);
                    if (targetEntryType.indexOf(otherRcd) > -1) {
                        me.reports.push(new Report(otherRcd, idxRcd, s_symbolic_list, 'race-g'));
                        break;
                    }
                }
                //let otherRcd = me.records.getAll().find(rcd => rcd.lineno == othervalues[0].lineno);
                //me.reports.push(new Report(otherRcd, idxRcd, s_symbolic_list, 'race-g'));
            }
            //console.log('detect: %s', JSON.stringify(idxRcd) + '\n'); 
        }
    }

    /**
     * 
     * @param {Record | ConcolicValue} o 
     */
    isUndefinedOrNull (o) {
        if (o.concrete)
            return o.concrete.startsWith(Prefix);
        else
            return o.val.startsWith(Prefix);
    }

    filterOutDuplicateReport () {
        let res = [];
        let me = this;
        let len = this.reports.length;

        for (let i = 0; i < this.reports.length; i++) {
            let report = this.reports[i];
            let saved = null;
            for (let j = 0; j < res.length; j++) {
                let _rpt = res[j];
                if (_rpt.equals(report)) {
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
        let info = '\n*** BUG REPORTS ***\n';
        info += 'Count of undefined bugs found: ' + this.reports.length + '\n';
        let count = 0;
        let reports = this.reports;
        let me = this;
        
        for (let rpt of reports) {
            count++;
            info += '[' + count + ']' + rpt.toString() + '\n';
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

class Report {
    constructor (rcd, undefRcd, alias, pattern) {
        this.tuple = [rcd, undefRcd];
        this.pointers = alias;
        this.ptn = pattern;
        this.iid = rcd.iid + ' vs. ' + undefRcd.iid;
        this.location = rcd.location + ' vs. ' + undefRcd.location;
        this.footprint = rcd.cbLoc + ' vs. ' + undefRcd.cbLoc;
        this.equivalent = [];
        this.id = Report.count++;
    }

    toString () {
        let res = this.footprint + ':' + this.ptn + '\n';
        this.tuple.forEach(rcd => {
            res += printObj(rcd, ['name', 'entryType', 'event', 'iid', 'location', 'lineno', 'val', 's_symbolic', 'valIsObject', 'cbLoc']);
            res += '\n';
        });
        res += 'pointers: ';
        res += JSON.stringify(this.pointers) + '\n';
        return res;
    }

    equals (other) {
        if (!other)
            return false;
        if (this.footprint == other.footprint)
            return true;
    }
}

Report.count = 0;

function unique (arr) {
    return Array.from(new Set(arr))
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

module.exports = Analyzer;