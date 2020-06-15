const path = require('path');
const fs = require('fs');

const graphUtil = require('../hb/util');
const createObjIdManager = require('./ObjIdManager');
const ConcolicValue = require('./ConcolicValue').ConcolicValue;
const AnnotatedExecution = require('./ConcolicValue').AnnotatedExecution;
const Point2 = require('./Point2');
const preprocess = require('./Preprocessor');

const getConcrete =  ConcolicValue.getConcrete;
const getSymbolic = ConcolicValue.getSymbolic;

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
            let entryType = record.entryType;
            let baseObjId = null;
            let val = record.val;
            let cval = null;
            let e = record.event;

            switch (entryType) {
                case 'WRITE':
                    if (!(me.annotatedExecution.searchConcolicValue(val, record.valIsObject)))
                        cval = new ConcolicValue(val, record.name, false, record.valIsObject, e, me.annotatedExecution, record.lineno);
                    else {
                        cval = me.annotatedExecution.addSymbolic(val, record.name, false, record.valIsObject, e, record.lineno);
                    }
                    break;
                case 'DELETE':
                case 'PUTFIELD':
                    baseObjId = record.name;
                    if (!(me.annotatedExecution.searchConcolicValue(val, record.valIsObject)))
                        cval = new ConcolicValue(val, {base: baseObjId, prop: record.prop}, true, record.valIsObject, e, me.annotatedExecution, record.lineno);
                    else
                        cval = me.annotatedExecution.addSymbolic(val, {base: baseObjId, prop: record.prop}, true, record.valIsObject, e, record.lineno);
                    break;
                case 'GETFIELD':
                    baseObjId = record.name;
                    if (!(me.annotatedExecution.searchConcolicValue(val, record.valIsObject)))
                        cval = new ConcolicValue(val, {base: baseObjId, prop: record.prop}, true, record.valIsObject, e, me.annotatedExecution, record.lineno);
                    else
                        cval = me.annotatedExecution.addSymbolic(val, {base: baseObjId, prop: record.prop}, true, record.valIsObject, e, record.lineno);
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
                record.s_symbolic = me.annotatedExecution.toString(record.symbolic, false);
                me.detect(record.s_symbolic);
            }
        }
    }

    analysis () {
        this.preprocess();
        this.imitateExecution();

        this.visualize();
    }

    visualize () {
        this.annotatedExecution.print();
        this.point2.print();
    }

    detect (s_symbolic_list) {
        let me = this;
        let objs = [];
        for (let s_symbolic of s_symbolic_list) {
          objs = [...objs, ...me.point2.getPoint2Objects(s_symbolic)];   
        }
        objs = unique(objs);
        if (objs.length >= 2) {
            var undefs = objs.filter(o => o.concrete.startsWith('*U*'));
            if (undefs.length > 0) {
                
            }
        }
    }

    printResult () {
        let info = '\n*** BUG REPORTS ***\n';
        info += 'Count of undefined bugs found: ' + this.reports.length + '\n';
        let count = 0;
        let reports = this.reports;
        let me = this;
        
        for (let rpt of reports) {
            count++;
            info += '[' + count + ']\n';
            info += '[suspect]: ' + rpt[0] + '\n';
            info += '[undef]: ' + rpt[1] + '\n';
            info += '[val]: ' + rpt[2] + '\n';
            let undefKey = [rpt[0], rpt[1]];
            let valKey = [rpt[0], rpt[2]];
            info += '[undefPath]: ' + me.path[undefKey].join(' -> ') + '\n';
            info += '[valPath]: ' + me.path[valKey].join(' -> ') + '\n\n';
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
    constructor (name, alias, obj_a, obj_b, pattern) {
        this.tuple = [name, alias];
        this.objects = [obj_a, obj_b];
        this.ptn = pattern;
        //TODO: iid, location, footprint(cbLoc)
    }

    toString () {
        let res = this.ptn + '\n';
        this.tuple.forEach(rcd => {
            res += printObj(rcd, ['name', 'entryType', 'event', 'iid', 'location', 'lineno', 'val']);
            res += '\n';
        });
        res += this.isPropagate.toString() + '\n';
        return res;
    }
}

function unique (arr) {
    return Array.from(new Set(arr))
}

module.exports = Analyzer;