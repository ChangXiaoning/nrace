const logger = require('../../../driver/logger.js').logger;

class DataFlowAnalyzer {
    constructor (relations, records, graph) {
        this.relations = relations;
        this.records = records;
        this.graph = graph;
        this.runs = 0;

        this.identifyUndefRcd();
    }

    identifyUndefRcd () {
        this.undefRcd = this.records.getAll().filter(rcd => 
            rcd.entryType == 'WRITE' && rcd.val == '-2');
    }

    start () {
        //TODO: we only consider events that is a callback function
        this.undefRcd.forEach(undefRcd => {
            let undef_e = undefRcd.event;
            let hb_e = this.relations.getHBSequence();
            //let trace = 
        })
    }

    

    generateTrace (hb_e, undef_e) {
        let trace = hb_e;
        this.relations.asyncObjs.getAll().forEach(e => {
            if (!trace.find(o => o.id == e.id)) {
                //trace generation strategy
            }
        });
    }

    analyze () {

    }
}