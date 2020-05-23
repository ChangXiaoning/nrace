const path = require('path');
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
        let events = this.asyncObjects.getAll();
        let me = this;

        for (let event of events) {
            let records = me.records.getAll().filter(rcd => rcd.event == event.id);
            let last = null;
            for (let record of records) {
                let entryType = record.entryType;
                let src = null;
                let dest = null;
                let type = null;
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
                    case 'PUFIELD':
                        //TODO: parse isOpAssign
                        dest = me.generateValNodeName(record);
                        let _src = me.generateNodeName(record);
                        src = me.point2Graph.searchDest(_src);
                        type = 'store';
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
                if (me.point2Graph.isLeafNode(node)) {
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

        return res;
    }

    interEventAnalyze () {
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
                if (eid != sameNameRcd_eid && !me.rg.happensBeforeWithGraphLib(eid, sameNameRcd_eid)) {
                    me.point2Graph.addEdge(leaf, sameNameRcd, 'inter');
                }
            }
        }
    }

    analysis () {
        this.intraEventAnalyze();
        this.interEventAnalyze();
        this.visualize();

        this.point2Graph.startGraphLibDataStructure();
        this.detect()
    }

    detect () {
       let nodes = this.point2Graph.getNodes();
       let undefinedNodes =  this.point2Graph.getUndefinedNodes();
       let me = this;

       let sources = nodes.filter(node => !me.point2Graph.isLeafNode(node));
       
       for (let src of sources) {
           for (let dest of undefinedNodes) {
               if (me.point2Graph.canArrive2(src, dest)) {
                   if (!me.reports.find(rpt => rpt == src))
                        me.reports.push(src);
               }
           }
       }

       console.log(this.reports);
    }

    visualize () {
        let filename = this.dataflowfile;
        this.point2Graph.draw(filename);
    }

    isUndefinedNode (node) {
        return node.startsWith('#');
    }

    isNullNode (node) {
        return node.startsWith('val_') && node.slice(4, 8) == 'null';
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
}

function unique (arr) {
    return Array.from(new Set(arr))
}

function isAssignment (rcd) {
    //TODO: parse isOpAssign
    return rcd.entryType == 'WRITE' || (rcd.entryType == 'PUTFIELD' && rcd.isOpAssign);
}

module.exports = Analyzer;