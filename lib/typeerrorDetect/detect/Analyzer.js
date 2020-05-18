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

        for (let location in cbinfos) {
            
            let code = cbinfos[location];
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
                var value = variable.inference();
                if( value ){
                    outline[variable.name] = value.toJSON();
                }
            }

            console.log(outline);
        }

        /*let events = this.asyncObjects.getAll()
                                        .map(event => event.id);
        for (let event of events) {
            let records = this.records.filter(record => record.event == event);
            records.array.forEach(rcd => {
                //TODO: putfield
                if (rcd.entryType == 'WRITE') {
                    let node = rcd.name + '@' + event.id;
                    this.point2Graph.addNode(node);
                }
            });
        }*/
    }
}

module.exports = Analyzer;