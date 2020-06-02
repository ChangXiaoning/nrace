const path = require('path');
const fs = require('fs');
const dfatool = require('dfatool');
const esprima = require('esprima');

const graphUtil = require('../hb/util');
const cbinfoUtil = require('./cbinfoUtil');
const Point2Graph = require('./Point2Graph');
const createObjIdManager = require('./ObjIdManager');
const ConcolicValue = require('./ConcolicValue');


const getConcrete =  ConcolicValue.getConcrete;
const getSymbolic = ConcolicValue.getSymbolic;

class Analyzer {
    constructor (appPath) {
        this.appPath = appPath;
        this.hbfile = path.resolve(appPath, './ascii-trace.hb.json');
        this.recordfile = path.resolve(appPath, './ascii-trace.access-records.json');
        this.cbInfoFile = path.resolve(appPath, './cbinfo.json');
        this.dataflowfile = path.resolve(appPath, './dataflow.png');
        this.resultfile = path.resolve(appPath, './bug-report.json');
        this.T = [];
        this.A = [];
 
        this.point2Graph = new Point2Graph();
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

        //this.cbinfo = cbinfoUtil.read(this.cbInfoFile);

    }

    preprocess () {
        this.dealWithDelete();
        this._wrapWithAnnotatedValue();
    }

    wrapWithAnnotatedValue () {
        let records = this.records.getAll();
        let me = this;

        for (let record of records) {
            let val = record.val;
            let cval = null;
            let entryType = record.entryType;

            //if (parseInt(val) <= 0)
                //continue;

            switch (entryType) {
                case 'READ':
                    if (!ConcolicValue.searchConcolicValue(val)) {
                        //TODO: symbolic?
                        cval = new ConcolicValue(val, null, false);     
                    } else {
                        cval = ConcolicValue.getConcolicValue(val);
                    }
                    record.val = cval;
                    break;
                case 'WRITE':
                    if (!ConcolicValue.searchConcolicValue(val)) {
                        cval = new ConcolicValue(val, record.name, false);     
                    } else {
                        cval = ConcolicValue.getConcolicValue(val);
                        //ConcolicValue.updateSymbolic({access_path: [], local: name});
                    }
                    record.val = cval;
                    break;
                case 'GETFIELD':
                case 'PUTFIELD':
                    var base = record.name;
                    var c_base = ConcolicValue.getConcolicValue(base);
                    if (!ConcolicValue.searchConcolicValue(val)) {
                        cval = new ConcolicValue(val, {base: base, prop: record.prop}, true);
                    } else {
                        cval = ConcolicValue.getConcolicValue(val);
                        //ConcolicValue.updateSymbolic({access_path: [], local: name});
                    }
                    record.val = cval;
                    break;
                  
            }
        }

        console.log(JSON.stringify(ConcolicValue.collection));
    }

    _wrapWithAnnotatedValue () {
        let records = this.records.getAll();
        let me = this;

        for (let record of records) {
            let val = record.val;
            let cval = null;
            let entryType = record.entryType;

            //if (parseInt(val) <= 0)
                //continue;

            switch (entryType) {
                case 'READ':
                case 'WRITE':
                    cval = new ConcolicValue(val, record.name, false);
                    record.val = cval;
                    break;
                case 'GETFIELD':
                case 'PUTFIELD':
                    var base = record.name;
                    cval = new ConcolicValue(val, {base: base, prop: record.prop}, true);
                    record.val = cval;
                    break;
            }
        }

        ConcolicValue.end();
        console.log(JSON.stringify(ConcolicValue.collection));
    }

    intraEventAnalyze () {
        let events = this.asyncObjects.getAll();
        let me = this;

        for (let event of events) {
            let records = me.records.getAll().filter(rcd => rcd.event == event.id);
            let last = null;
            for (let record of records) {
                let _in = last ? last.reachable : [];
                let out = null;
                let reachable = [];
                if (isAssignment(record)) {
                    let assignment = record;
                    let gen = {
                        name: record.name,
                        lineno: record.lineno,
                        iid: record.iid,
                        event: event.id,
                    };
                    reachable.push(gen);
                    _in.forEach(r => {
                        if (r.name == record.name && r.lineno < record.lineno && r.event == record.event) {
                            //kill;
                        } else {
                            reachable.push(r);
                        }
                    });
                } else {
                    reachable = [...reachable, ..._in];
                }
                record.reachable = reachable;
                out = record.reachable;
                last = record;

                //draw intra-event edges
                let src_node = me.generateNodeName(record.name, event.id, record.lineno);
                record.reachable.forEach(reachable => {
                    let dest_node = me.generateNodeName(reachable.name, reachable.event, reachable.lineno);
                    //not add edge if src is same to dest?
                    //if (src_node != dest_node)
                        me.point2Graph.addEdge(src_node, dest_node, 'intra');
                });
            }
        }
    }

    intraEventAnalyze () {
        console.log('intra-event analysis');
        let events = this.asyncObjects.getAll();
        let me = this;
        let rcdCnt = 0;

        for (let event of events) {
            let records = me.records.getAll().filter(rcd => rcd.event == event.id);
            let last = null;
            for (let record of records) {
                console.log('No. %d record', ++rcdCnt);
                //console.log("%s", JSON.stringify(record));
                if (record.lineno == '3238') {
                    console.log('');
                }
                let entryType = record.entryType;
                let src = null;
                let dest = null;
                let type = null;
                let _src = null;
                switch (entryType) {
                    case 'CREATE_OBJ':
                        let node = me.generateValNodeName(record);
                        me.point2Graph.addNode(node);
                        break; 
                    case 'WRITE':
                        src = me.generateNodeName(record);
                        
                        let rightVal = me.computeRightValue(record);
                        dest = rightVal.dest;
                        type = rightVal.type;

                        //overwrite the previous assignment
                        //TODO: remove putfield assignment
                        /*let outcommings = me.point2Graph.searchOutComing(src);
                        for (let edge of outcommings) {
                            if (edge.type.startsWith('assign')) {
                                me.point2Graph.removeEdge(edge.src, edge.dest, edge.type);
                            }
                        }*/
                        break;
                    case 'PUTFIELD': 
                        dest = me.generateValNodeName(record);
                        _src = me.generateNodeName(record);
                        //case 1: base is the base
                        //case 2: base is the property of another
                        //object, i.e., the property of another object
                        //is also an object, used here
                        if (me.point2Graph.isNodeExist(_src))
                            src = me.point2Graph.searchObjDest(_src);
                        else {
                            //case 2-1:
                            //check if base is a property of other
                            //object && it is dynamically added, i.e.,
                            //x = {}; x.p = {}; x.p.y = z;
                            let t = me.generateNodeName(record, false)
                            if (t)
                                src = t;
                            //TODO:
                            //case 2-2: x = {p: ...}; x.p = ...;
                            //dynamically change property
                        }
                        //src = me.point2Graph.searchObjDest(_src);
                        let prop = record.prop;
                        type = 'store_' + prop + '_' + record.lineno;
                        break;
                    case 'DECLARE':
                        //case: var x; but not initialized in this
                        //event
                        if (!record.initialized) {
                            src = me.generateNodeName(record);
                            dest = me.generateValNodeName(record);
                            type = 'dlr_' + record.lineno;
                        }
                        break; 
                    case 'DELETE':
                        //case: delete x.p equals to assign undefined
                        //to x.p
                        dest = me.generateValNodeName(record);

                        _src = me.generateNodeName(record);
                        //case 1: base is the base
                        //case 2: base is the property of another
                        //object, i.e., the property of another object
                        //is also an object, used here
                        if (me.point2Graph.isNodeExist(_src))
                            src = me.point2Graph.searchObjDest(_src);
                        else {
                            //case 2-1:
                            //check if base is a property of other
                            //object && it is dynamically added, i.e.,
                            //x = {}; x.p = {}; delete x.p.y;
                            let t = me.generateNodeName(record, false)
                            if (t)
                                src = t;
                            //TODO:
                            //case 2-2: x = {p: ...}; x.p = ...;
                            //dynamically change property
                        }
                        
                        type = 'del_' + record.prop;
                        break;
                }
                if (src && dest && type)
                    me.point2Graph.addEdge(src, dest, type);                
            }
        }
    }

    intraEventAnalyze () {
        console.log('intra-event analysis');
        let events = this.asyncObjects.getAll();
        let me = this;

        for (let event of events) {
            let records = me.records.getAll().filter(rcd => rcd.event == event.id);
            let last = null;
            me.forwardsAnalysis(event.id, records);
        }
    }

    forwardsAnalysis (eid, records) {
        let me = this;
        this.T[eid] = [];

        for (let record of records) {
            let leftval = null;
            let rightval = null;
            let entryType = record.entryType;
            switch (entryType) {
                case 'WRITE':
                    leftval = record.name;
                    rightval = me.valIsObject(record.val)? me._computeRightVal(record) : {name: null, type: 'based'};
                    if (record.val == '-2' || record.val == '-3')
                        me.T.push(leftval);
                    break;
                case 'PUTFIELD':
                    //TODO: compute left value
                    leftval = me.computeAccessPath(record);
                    rightval = me.valIsObject(record.val)? me._computeRightVal(record) : {name: null, type: 'based'};
                    if (record.val == '-2' || record.val == '-3') {
                        let id = [leftval.local_name, ...leftval.p].join('$');
                        me.T.push(id);
                        //start backward analysis
                        me.backwardAnalysis(record);
                    }
                    break;
            }
            if (entryType == 'WRITE' || entryType == 'PUTFIELD') {
                console.log('leftval: %s, rightval: %s', JSON.stringify(leftval), JSON.stringify(rightval));
                console.log('taints: %s', me.T);
            }
        }
    }

    isTaint (name) {
        if (name && typeof(name) === 'object') {
            let local_name = name.local_name;
            let p = name.p;
            let id = [local_name, ...p].join('$');
            for (let taint of this.T) {
                if (id.startsWith(taint))
                    return true;
            }
        }
        return false;
    }

    _computeRightVal (record) {
        let me = this;
        let records = this.records.getAll();
        let val = record.val;
        let name = null;
        let type = null;
        let access_path = null;
        
        let loadRcd = this.findNearestLoad(record);
        if (loadRcd) {
            switch (loadRcd.entryType) {
                //case: x = o1 | x = y + z (y+z is an object)
                case 'CREATE_OBJ':
                    name = loadRcd.name;
                    type = 'create';
                    break;
                //case x = y (y is an object)
                case 'READ':
                    name = loadRcd.name;
                    type = 'read';
                    break;
                //x = y.p (y.p is an object)
                //x = y.p1.p2
                case 'GETFIELD':
                    name = me.computeAccessPath(loadRcd);
                    type = 'getfield';
                    break;
            }
        }

        return {name: name, type: type};
    }

    computeAccessPath (record) {
        let records = this.records.getAll();
        let local_name = null;
        let access_path = [];

        if (record.entryType == 'GETFIELD' || record.entryType == 'PUTFIELD') {
            access_path.push(record.prop);
            let index = record.lineno;
            let baseid = record.name;
            let loadRcds = records.filter(rcd => parseInt(rcd.lineno) < parseInt(record.lineno) &&
                rcd.val == baseid && rcd.entryType == 'GETFIELD');
            let loadRcd = loadRcds[loadRcds.length - 1];
            while (loadRcd) {
                access_path.push(loadRcd.prop);
                index = loadRcd.lineno;
                baseid = loadRcd.name;
                loadRcds = records.filter(rcd => parseInt(rcd.lineno) < parseInt(record.lineno) &&
                                            rcd.val == baseid && rcd.entryType == 'GETFIELD');
                if (loadRcds.length > 0) {
                    loadRcd = loadRcds[loadRcds.length - 1];
                }
            }
            //search for local name
            let readRcd = records.find(rcd => parseInt(rcd.lineno) == parseInt(index) - 1);
            if (readRcd) 
                local_name = readRcd.name;
        }

        return {local_name: local_name, p: access_path.reverse()};
    }

    backwardAnalysis (seed) {

    }

    computeName2rcds () {
        let nodes = this.point2Graph.getNodes();
        let res = {};

        for (let node of nodes) {
            let name = node.slice(0, node.indexOf('@'));
            if (name.startsWith('obj_') || node.startsWith('val_')) {
                continue;
            }
            res[name] = res[name] ? res[name] : [];
            res[name].push(node);
        }

        //this.name2rcds = res;
        return res;
    }

    interEventAnalyze () {
        console.log('inter-event analysis');
        let records = this.computeLeaf();
        let ev2rcds = records.ev2rcds;
        let name2rcds = this.computeName2rcds();
        let leaves = records.leaf;

        let me = this;

        for (let leaf of leaves) {
            let metadata = leaf.split('@');
            let eid = metadata[1];
            let name = metadata[0];

            if (name.startsWith('obj_') || name.startsWith('val_'))
                continue;

            let rcdsWithSameName = name2rcds[name];
            for (let sameNameRcd of rcdsWithSameName) {
                let sameNameRcd_eid = sameNameRcd.split('@')[1];
                if (eid == sameNameRcd_eid)
                    continue;
                console.log('leaf: %s vs. %s', leaf, sameNameRcd);
                if (me.rg.isConcurWithGraphLib(eid, sameNameRcd_eid)) {
                    console.log('add inter: %s -> %s', leaf, sameNameRcd);
                    me.point2Graph.addEdge(leaf, sameNameRcd, 'inter');
                }
            }
        }
    }

    analysis () {
        this.preprocess();
        //this.intraEventAnalyze();
        
        //this.interEventAnalyze();

        //this.point2Graph.startGraphLibDataStructure();
        //this.detect()

        //this.visualize();
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

    oneOfUndefined () {
        let reports = this.reports.slice();
        let valNodes = this.point2Graph.getValNodes();
        let len = valNodes.length;
        let nodes = this.point2Graph.getNodes();     
        let me = this;

        for (let rpt of this.reports) {
            let suspect = rpt[0];
            let undef = rpt[1];
            let undefPath = me.path[rpt];
            //count the number of values that rpt[0] cannot point to
            let counter = 0;
            for (let valnode of valNodes) {

                //FP1: x -> obj -> undefined
                if (undefPath.find(n => n == valnode)) {
                    counter++;
                    continue;
                }

                let tuple = [suspect, valnode];
                if (me.path[tuple] || me.point2Graph.canArrive2(suspect, valnode)) {
                    let pth = me.path[tuple] ? me.path[tuple] : me.point2Graph.searchPath(suspect, valnode);
                    me.path[tuple] = pth;
                    rpt.push(valnode);
                    break;
                }
                counter++;
            }
            if (counter == len) {
                reports.splice(reports.indexOf(rpt), 1);
            }
        }

        this.reports = reports;
    }

    visualize () {
        let filename = this.dataflowfile;
        let me = this;
        let suspectList = [];
        let valList = [];

        for (let triple of this.reports) {
            let suspect = triple[0];
            let val = triple[2];
            suspectList.push(suspect);
            valList.push(val);
        }

        suspectList = unique(suspectList);
        valList = unique(valList);
        this.point2Graph.draw(filename, suspectList, valList);
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

    findNearestLoad (record, isSameEvent = true) {
        let records = this.records.getAll();
        let loadRcds = null;
        if (isSameEvent)
            loadRcds = records.filter(rcd => parseInt(rcd.lineno) < parseInt(record.lineno) &&
                                        (rcd.val == record.val || rcd.val == '0' && record.val == '-1' || rcd.val == '-1' && record.val == '0') && 
                                        rcd.event == record.event);
        else 
            loadRcds = records.filter(rcd => parseInt(rcd.lineno) < parseInt(record.lineno) &&
                                        (rcd.val == record.val || rcd.val == '0' && record.val == '-1' || rcd.val == '-1' && record.val == '0'));
        if (loadRcds.length > 0) 
            return loadRcds[loadRcds.length - 1];
        else 
            return null;
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