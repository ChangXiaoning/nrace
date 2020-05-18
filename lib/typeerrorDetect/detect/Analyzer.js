const path = require('path');
const dfatool = require('dfatool');
const esprima = require('esprima');

const graphUtil = require('../hb/util');
const cbinfoUtil = require('./cbinfoUtil');
const Point2Graph = require('./Point2Graph');

class Analyzer {
    constructor (appPath) {
        this.appPath = appPath;
        this.hbfile = path.resolve(appPath, './ascii-trace.hb.json');
        this.recordfile = path.resolve(appPath, './ascii-trace.access-records.json');
        this.cbInfoFile = path.resolve(appPath, './cbinfo.json');
 
        this.point2Graph = new Point2Graph();

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

            var outline = {};

            // Iterate all the defined variables and inference its value
            for(var name in globalScope._defines){
                var variable = globalScope._defines[name];
                //skip the window variable
                if (variable.name != 'window') {
                    var value = variable.inference();
                    if (value) {
                        outline[variable.name] = value.toJSON();
                    }
                }
            }

            //iterate all defined variables and its inferred value
            for (let name in outline) {
                //value is [name, type, accessPath, properties,
                //(object: properties | array: elements | expression |
                //others)]
                let value = outline[name];
                let src_name = name + '@' + id;
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
                            let _identifier = identifier + '@' + id;
                            this.point2Graph.addEdge(src_name, identifier, 'intra');
                        }
                        break;
                        //TODO: object and array?
                    default:
                        //other kinds of values, include literal
                        let value_node = 'val_' + value.value + '@' + id;
                        this.point2Graph.addEdge(src_name, value_node, 'intra');
                        console.log('add value edge: %s -> %s', src_name, value_node);
                }
            }
        }
    }
}

function unique (arr) {
    return Array.from(new Set(arr))
}

module.exports = Analyzer;