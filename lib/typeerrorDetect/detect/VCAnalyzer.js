const path = require('path');
const fs = require('fs');

const graphUtil = require('../hb/util');
var VectorClock = require('./VectorClock');

class Analyzer {
    constructor (appPath) {
        this.appPath = appPath;
        this.hbfile = path.resolve(appPath, './ascii-trace.hb.json');
        this.recordfile = path.resolve(appPath, './ascii-trace.access-records.json');
        this.ctxfile = path.resolve(appPath, './ascii-trace.context.json');
        this.ctxchainfile = path.resolve(appPath, './ascii-trace.dyContext-chain.json');
        this.resultfile = path.resolve(appPath, './bug-report.json');
        this.actionsfile = path.resolve(appPath, './ascii-trace.actions.json');
        
        this.init();

        this.reports = [];
        this.fs_reports = [];
    }

    init () {
        let info = graphUtil.read(this.hbfile, this.recordfile, this.ctxfile, this.ctxchainfile, this.actionsfile);

        this.records = info.records;
        this.asyncObjects = info.asyncObjects;
        this.contexts = info.contexts;
        this.contextchain = info.contextchain;
        this.actions = info.actions;
        this.task_num = this.asyncObjects.getAll().length;

        this.vcs = {}; //map[eid] = vc
    }

    findOrCreateVC (eid) {
        var result = this.findVC(eid);
        if (result) return result;
        else return new VectorClock(this.task_num);
    }

    findVC (eid) {
        return this.vcs[eid] ? this.vcs[eid] : null;
    }

    buildVCs (relations) {
        let events = this.asyncObjects.getAll();

        for (let i = 0; i < events.length; i++) {
            let ei = events[i];
            let hbevents = [];
            for (let j = 0; j < i; j++) {
                let ej = events[j];
                //TODO; has() api
                if (relations.has(ej, ei)) hbevents.push(ej);
            }
            this.createVC(vcs);
        }
    }

    //Create a vector clock based on hb edges
    createVC (vcs) {
        return VectorClock.inct(vcs, this.task_num);
    }

    isHB (e1, e2) {
        let vc1 = this.findVC(e1);
        let vc2 = this.findVC(e2);
        
        return VectorClock.compare(vc1, vc2) ? true : false;
    }
}

module.exports = Analyzer;