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
    }

    init () {
        let info = graphUtil.read(this.hbfile, this.recordfile);
        this.rg = info.relations;
        this.records = info.records;
        this.asyncObjects = info.asyncObjects;

        this.rg.startGraphLibDataStructure();

        this.cbinfo = cbinfoUtil.read(this.cbInfoFile);
    }

    intraEventAnalyze () {
        let cbinfos = this.cbinfo;
        let outline = [];

        for (let cb of cbinfos) {
            
            let id = cb.id;
            let location = cb.location;
            let code = cb.code;
            console.log('location: %s, code: %s\n', location, code);

            var ast = esprima.parse(code, {
                loc : true
            });
            
            var globalScope = dfatool.newGlobalScope();
            dfatool.buildScope(ast, globalScope);
            
            globalScope.initialize();
            globalScope.derivation();

            // Iterate all the defined variables and inference its value
            for(var name in globalScope._defines){
                var variable = globalScope._defines[name];
                //skip the window variable
                if (variable.name != 'window') {
                    var value = variable.inference();
                    if (value) {
                        outline.push({
                            eid: id,
                            name: variable.name,
                            value: value.toJSON(),
                        });
                    }
                }
            }
        }

        //iterate all defined variables and its inferred value
        for (let variable of outline) {
            //value is [name, type, accessPath, properties,
            //(object: properties | array: elements | expression |
            //others)]
            let eid = variable.eid;
            let name = variable.name;
            let value = variable.value;
            
            let src_name = name + '@' + eid;
            let value_node = null;
            switch (value.type) {
                case 'expression':
                    let identifiers = [];
                    let ast = esprima.parse(value.expression);
                    dfatool.walk(ast, function (node) {
                        if (node.type == "FunctionExpression" ||
                            node.type == "ObjectExpression" ||
                            node.type == "ArrayExpression" ||
                            node.type == "MemberExpression" ||
                            node.type == "FunctionDeclaration") {
                            return false;
                        }
                        return true;
                    }, function (node) {
                        switch(node.type) {
                            case "Identifier":
                                let name = node.name;
                                identifiers.push(name);
                                break;
                        }
                    });
                    let _identifiers = unique(identifiers)
                    console.log('identifiers: %s', identifiers);
                    for (let identifier of _identifiers) {
                        let _identifier = identifier + '@' + eid;
                        this.point2Graph.addEdge(src_name, _identifier, 'intra');
                        console.log('add value edge: %s -> %s', src_name, _identifier);
                    }
                    break;
                    //TODO: object and array?
                case 'object':
                    let val = value.properties;
                    let valId = this.idManager.findOrCreateUniqueId(val);
                    value_node = 'obj_' + valId + '@' + eid;
                    this.point2Graph.addEdge(src_name, value_node, 'intra');
                    console.log('object: %s -> %s', src_name, value_node);
                    break;
                default:
                    //other kinds of values, include literal
                    value_node = 'val_' + value.value + '@' + eid;
                    this.point2Graph.addEdge(src_name, value_node, 'intra');
                    console.log('val: %s -> %s', src_name, value_node);
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
                if (!node.startsWith('obj_') && !node.startsWith('val_')) {
                    if (me.point2Graph.getOutComingNum(node) == 0) {
                        if (!leaves.find(n => n == node))
                            leaves.push(node);
                    }
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
            let _name = null;
            if (!name.startsWith('obj_') && !node.startsWith('val_')) {
                _name = name;
            }
            res[_name] = res[_name] ? res[_name] : [];
            res[_name].push(node);
        }

        return res;
    }

    interEventAnalyze () {
        let records = this.computeLeaf();
        let ev2rcds = records.ev2rcds;
        let name2rcds = this.computeName2rcds();
        let leaves = records.leaf;

        let events = this.asyncObjects.getAll();
        let me = this;

        for (let leaf of leaves) {
            let metadata = leaf.split('@');
            let eid = metadata[1];
            let name = metadata[0];

            let rcdsWithSameName = name2rcds[name];
            for (let sameNameRcd of rcdsWithSameName) {
                let sameNameRcd_eid = sameNameRcd.split('@')[1];
                if (eid != sameNameRcd_eid && !me.rg.happensBeforeWithGraphLib(eid, sameNameRcd_eid)) {
                    me.point2Graph.addEdge(sameNameRcd, leaf, 'inter');
                }
            }
        }
    }

    analysis () {
        this.intraEventAnalyze();
        this.interEventAnalyze();
        this.visualize();
    }

    visualize () {
        let filename = this.dataflowfile;
        this.point2Graph.draw(filename);
    }
}

function unique (arr) {
    return Array.from(new Set(arr))
}

module.exports = Analyzer;