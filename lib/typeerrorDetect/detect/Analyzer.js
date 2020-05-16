var dfatool = require('dfatool');
var esprima = require('esprima');
var Point2Graph = require('./Point2Graph');

class Analyzer {
    constructor (asyncObjects, records, graph) {
        this.asyncObjects = asyncObjects;
        this.records = records;
        this.graph = graph;

        this.point2Graph = new Point2Graph();
    }

    intraEventAnalyze () {
        let events = this.asyncObjects.getAll()
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
        }
    }
}

module.exports = Analyzer;