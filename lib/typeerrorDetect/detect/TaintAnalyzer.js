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
        this.resultfile = path.resolve(appPath, './bug-report.json');

        this.idManager = createObjIdManager();

        this.init();

        this.reports = [];
    }

    init () {
        let info = graphUtil.read(this.hbfile, this.recordfile);
        this.rg = info.relations;
        this.records = info.records;
        this.asyncObjects = info.asyncObjects;

        this.rg.startGraphLibDataStructure();
        this.annotatedExecution = new AnnotatedExecution(this.rg);
        this.point2 = new Point2(this.rg);
    }

    preprocess () {
        //preprocess(this.records.getAll());
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
        for (let record of records) {
            //if (record.isDeclaredLocal) continue;
            let entryType = record.entryType;
            let baseObjId = null;
            let val = record.val;
            let cval = null;
            let e = record.event;

            if (record.lineno == '2644') {
                console.log('bug');
            }

            switch (entryType) {
                case 'WRITE':
                case 'READ':
                    if (!(me.annotatedExecution.searchConcolicValue(val, record.valIsObject)))
                        cval = new ConcolicValue(val, record.name, false, record.valIsObject, e, me.annotatedExecution, record.lineno);
                    else {
                        var isDeclaredLocal = record.isDeclaredLocal? true: false;
                        cval = me.annotatedExecution.addSymbolic(val, record.name, false, record.valIsObject, e, record.lineno, isDeclaredLocal);
                    }
                    break;
                case 'DELETE':
                case 'PUTFIELD':
                case 'GETFIELD':
                    baseObjId = record.name;
                    //wierd: obj.f == obj//true
                    if (baseObjId != val) {
                        if (!(me.annotatedExecution.searchConcolicValue(val, record.valIsObject)))
                            cval = new ConcolicValue(val, {base: baseObjId, prop: record.prop}, true, record.valIsObject, e, me.annotatedExecution, record.lineno);
                        else {
                            var isDeclaredLocal = record.isDeclaredLocal? true: false;
                            cval = me.annotatedExecution.addSymbolic(val, {base: baseObjId, prop: record.prop}, true, record.valIsObject, e, record.lineno, isDeclaredLocal);
                        }
                    } else {
                        //console.log('ignore: %s', JSON.stringify(record));
                    }
                    break;
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

            if (entryType == 'WRITE' || entryType == 'PUTFIELD' || entryType == 'DELETE') {
                var overwrites = me.annotatedExecution.backwardUpdateSymbolic(cval);
                if (overwrites.size > 0)
                    me.point2.removePoint2(overwrites);
            }
            if (cval) {
                record.symbolic = cval.symbolic;
                record.s_symbolic = unique( me.annotatedExecution.toString(record.symbolic, false) );
                me.detect(record, record.s_symbolic);
            }
        }
    }

    analysis () {
        this.preprocess();
        this.imitateExecution();

        this.visualize();
        this.printReports();
    }

    visualize () {
        this.annotatedExecution.print();
        this.point2.print();
    }

    detect (idxRcd, s_symbolic_list) {
        //FP-1: isDeclaredLocal
        if ((idxRcd.isDeclaredLocal))
            return;
        let me = this;
        let objs = [];
        for (let s_symbolic of s_symbolic_list) {
          objs = [...objs, ...me.point2.getPoint2Objects(s_symbolic)];   
        }
        objs = unique(objs);
        if (idxRcd.lineno == '3639')
            console.log('detect bug');
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
     * 
     * @param {Record | ConcolicValue} o 
     */
    isUndefinedOrNull (o) {
        if (o.concrete)
            return o.concrete.startsWith(Prefix);
        else
            return o.val.startsWith(Prefix);
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
    }

    toString () {
        let res = this.footprint + ':' + this.ptn + '\n';
        this.tuple.forEach(rcd => {
            res += printObj(rcd, ['name', 'entryType', 'event', 'iid', 'location', 'lineno', 'val', 's_symbolic']);
            res += '\n';
        });
        res += 'pointers: ';
        res += JSON.stringify(this.pointers) + '\n';
        return res;
    }
}

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