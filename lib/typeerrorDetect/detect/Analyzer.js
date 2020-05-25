const path = require('path');
const fs = require('fs');
const dfatool = require('dfatool');
const esprima = require('esprima');

const graphUtil = require('../hb/util');
const cbinfoUtil = require('./cbinfoUtil');
const Point2Graph = require('./Point2Graph');
const createObjIdManager = require('./ObjIdManager');

class Analyzer {
    constructor (appPath) {
        this.appPath = appPath;
        this.hbfile = path.resolve(appPath, './ascii-trace.hb.json');
        this.recordfile = path.resolve(appPath, './ascii-trace.access-records.json');
        this.cbInfoFile = path.resolve(appPath, './cbinfo.json');
        this.dataflowfile = path.resolve(appPath, './dataflow.png');
        this.resultfile = path.resolve(appPath, './bug-report.json');
 
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
        this.dealWithDeclare();
        this.dealWithDelete();
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
                console.log("%s", JSON.stringify(record));
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
                        
                        let val = record.val;
                        if (me.valIsObject(val)) {
                            //it is possible loadRcd from other events
                            let loadRcd = me.findNearestLoad(record);
                            if (loadRcd) {
                                switch (loadRcd.entryType) {
                                    //case: x = o1 | x = y + z (y+z is an object)
                                    case 'CREATE_OBJ':
                                        dest = me.generateValNodeName(loadRcd);
                                        type = 'assign';
                                        break;
                                    //case x = y (y is an object)
                                    case 'READ':
                                        dest = me.generateNodeName(loadRcd);
                                        type = 'assign';
                                        break
                                    //x = y.p (y.p is an object)
                                    case 'GETFIELD':
                                        dest = me.generateValNodeName(loadRcd);
                                        type = 'load';
                                        break;
                                }
                            }
                        } else {
                            switch (val) {
                                case '0':
                                    //case: x = 1 | x = y (y is based type)
                                    //it is possible loadRcd from other events
                                    let loadRcd = me.findNearestLoad(record);
                                    //case: x = y
                                    if (loadRcd)
                                        dest = me.generateNodeName(loadRcd);
                                    else
                                        //case x = 1
                                        dest = me.generateValNodeName(record);
                                    type = 'assign';
                                    break;
                                case '-2':
                                    dest = me.generateValNodeName(record);
                                    type = 'assign';
                                    break;
                                case '-3':
                                    dest = me.generateValNodeName(record);
                                    type = 'assign';
                                    break;
                            }
                        }
                        break;
                    case 'PUTFIELD': 
                        dest = me.generateValNodeName(record);
                        _src = me.generateNodeName(record);
                        src = me.point2Graph.searchObjDest(_src);
                        let prop = record.prop;
                        type = 'store_' + prop;
                        break;
                    case 'DECLARE':
                        //case: var x; but not initialized in this
                        //event
                        if (!record.initialized) {
                            src = me.generateNodeName(record);
                            dest = me.generateValNodeName(record);
                            type = 'dlr';
                        }
                        break; 
                    case 'DELETE':
                        //case: delete x.p equals to assign undefined
                        //to x.p
                        dest = me.generateValNodeName(record);
                        _src = me.generateNodeName(record);
                        src = me.point2Graph.searchObjDest(_src)
                        type = 'del_' + record.prop;
                        break;
                }
                if (src && dest && type)
                    me.point2Graph.addEdge(src, dest, type);                
            }
        }
    }

    computeLeaf () {
        let nodes = this.point2Graph.getNodes();
        let events = this.asyncObjects.getAll();
        let me = this;
        let res = [];
        let ev2rcds = {};

        events.forEach(event => {
            //ev2rcds[event.id] = ev2rcds[event.id] ? ev2rcds[event.id] : [];
            
            let _nodes = nodes.filter(n => {
                let eid = n.split('@')[1];
                return eid == event.id;
            });
            ev2rcds[event.id] = _nodes;
            
            //leaf
            let leaves = [];
            _nodes.forEach(node => {
                if (me.point2Graph.isLeafNode(node) && !me._isValNode(node)) {
                    if (!leaves.find(n => n == node))
                        leaves.push(node);
                }
            });
            res = [...res, ...leaves];
        });

        return { ev2rcds: ev2rcds, leaf: res };
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
        this.intraEventAnalyze();
        
        this.interEventAnalyze();

        this.point2Graph.startGraphLibDataStructure();
        this.detect()

        this.visualize();
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
            let counter = 0;
            for (let valnode of valNodes) {
                let tuple = [suspect, valnode];
                if (me.path[tuple] || me.point2Graph.canArrive2(suspect, valnode)) {
                    let pth = me.point2Graph.searchPath(suspect, valnode);
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

    isUndefinedNode (node) {
        return node.startsWith('undefined');
    }

    isNullNode (node) {
        return node.startsWith('null');
    }

    isValNode (node) {
        return node.startsWith('obj_') || node.startsWith('val_');
    }

    _isValNode (node) {
        return this.isUndefinedNode(node) || this.isNullNode(node) || this.isValNode(node);
    }

    generateNodeName (record) {
        var res = null;
        switch (record.entryType) {
            case 'PUTFIELD':
            case 'GETFIELD':
                res = [record.basename, record.event].join('@');
                break;
            default:
                res = [record.name, record.event].join('@');
        }
        return res;
    }

    generateValNodeName (record) {
        let val = record.val;
        if (this.valIsObject(val))
            return 'obj_' + val + '@' + record.event;
        else {
            let firstVal = null;
            switch (record.val) {
                case '-2':
                    firstVal = 'undefined';
                    break;
                case '-3':
                    firstVal = 'null';
                    break;
                default:
                    firstVal = 'val_0';
            }
            return [firstVal, record.event, record.lineno].join('@');
        }
    }

    valIsObject (val) {
        return parseInt(val) > 0;
    }

    findNearestLoad (record, isSameEvent = false) {
        let records = this.records.getAll();
        let loadRcds = null;
        if (isSameEvent)
            loadRcds = records.filter(rcd => parseInt(rcd.lineno) < parseInt(record.lineno) &&
                                        rcd.val == record.val && rcd.event == record.event);
        else 
            loadRcds = records.filter(rcd => parseInt(rcd.lineno) < parseInt(record.lineno) &&
                                       rcd.val == record.val);
        if (loadRcds.length > 0) 
            return loadRcds[loadRcds.length - 1];
        else 
            return null;
    }

    dealWithDeclare () {
        let varDeclares = this.records.getAll().filter(rcd => rcd.entryType == 'DECLARE' && (rcd.val == '-2' || rcd.val == '-3'));
        varDeclares.forEach(declare => {
            let rcdWithSameName = this.records.getAll().filter(rcd => rcd.name == declare.name || rcd.basename == declare.name);
            rcdWithSameName.forEach(r => {
                if ((r.entryType == 'WRITE' || r.entryType == 'PUTFIELD') && declare.event == r.event && declare.lineno < r.lineno) {
                    declare.initialized = r.val;
                }
            });
        });
    }

    dealWithDelete () {
        this.records.getAll()
                    .filter(rcd => rcd.entryType == 'DELETE' || rcd.entryType =='PUTFIELD' || rcd.entryType == 'GETFIELD')
                    .forEach(del => {
                        del.name = del.basename;
                        //TODO: prop?
                        del.prop = del.propname;
                        //add val
                        if (del.entryType == 'DELETE')
                            del.val = "-2";
                    });
    }

}

function unique (arr) {
    return Array.from(new Set(arr))
}

function isAssignment (rcd) {
    return rcd.entryType == 'WRITE' || (rcd.entryType == 'PUTFIELD' && rcd.isOpAssign);
}

module.exports = Analyzer;