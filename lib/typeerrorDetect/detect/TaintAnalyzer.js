const path = require('path');
const fs = require('fs');

const graphUtil = require('../hb/util');
const createObjIdManager = require('./ObjIdManager');
const ConcolicValue = require('./ConcolicValue');


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

    }

    preprocess () {
        this.dealWithDelete();
    }

    intraEventAnalyze () {
        let events = this.asyncObjects.getAll();
        let me = this;

        for (let event of events) {
            let records = me.records.getAll().filter(rcd => rcd.event == event.id);
            me.concolicExecution(records);
        }
    }

    concolicExecution (records) {
        for (let record of records) {
            let entryType = record.entryType;
            let baseObjId = null;
            let val = record.val;
            let cval = null;
            //let name = record.name;

            switch (entryType) {
                case 'WRITE':
                    if (!(ConcolicValue.searchConcolicValue(val)))
                        cval = new ConcolicValue(val, record.name, false);
                    else {
                        cval = ConcolicValue.addSymbolic(val, record.name, false);
                    }
                    break;
                case 'PUTFIELD':
                    baseObjId = record.name;
                    if (!(ConcolicValue.searchConcolicValue(val)))
                        cval = new ConcolicValue(val, {base: baseObjId, prop: record.prop}, true);
                    else
                        cval = ConcolicValue.addSymbolic(val, {base: baseObjId, prop: record.prop}, true);
                    break;
                case 'GETFIELD':
                    baseObjId = record.name;
                    if (!(ConcolicValue.searchConcolicValue(val)))
                        cval = new ConcolicValue(val, {base: baseObjId, prop: record.prop}, true);
                    else
                        cval = ConcolicValue.addSymbolic(val, {base: baseObjId, prop: record.prop}, true);
                    break;
            }

            if (entryType == 'WRITE' || entryType == 'PUTFIELD') {
                ConcolicValue.backwardUpdateSymbolic(cval);
            }
            //TODO: access_path for each record
        }
    }

    analysis () {
        this.preprocess();
        this.intraEventAnalyze();
        
        //this.interEventAnalyze();

        //this.point2Graph.startGraphLibDataStructure();
        //this.detect()

        this.visualize();
    }

    visualize () {
        ConcolicValue.print();
    }

    detect () {
        console.log('start detect ...');
       let nodes = this.point2Graph.getNodes();
       let undefinedNodes =  this.point2Graph.getUndefinedNodes();
       let me = this;
       this.path = {};

       let sources = nodes.filter(node => !me.point2Graph.isLeafNode(node) && !me.isValNode(node));
       
       for (let src of sources) {
           for (let dest of undefinedNodes) {
               if (me.point2Graph.canArrive2(src, dest)) {
                   let tuple = [src, dest];
                   if (!me.reports.find(rpt => rpt == src)) 
                        me.reports.push([src, dest]);
                    if (!me.path[tuple]) {
                        let pth = me.point2Graph.searchPath(src, dest);
                        me.path[tuple] = pth;
                    }
               }
           }
       }

       this.oneOfUndefined();

       this.printResult();
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

    valIsObject (val) {
        return parseInt(val) > 0;
    }

    dealWithDelete () {
        this.records.getAll()
                    .filter(rcd => rcd.entryType == 'DELETE' /*|| rcd.entryType =='PUTFIELD' || rcd.entryType == 'GETFIELD'*/)
                    .forEach(del => {
                        //del.name = del.basename;
                        del.prop = del.propname;
                        //add val
                        if (del.entryType == 'DELETE')
                            del.val = "-2";
                    });
    }

}

module.exports = Analyzer;