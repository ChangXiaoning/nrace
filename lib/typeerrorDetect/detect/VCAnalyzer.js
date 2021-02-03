const path = require('path');
const fs = require('fs');

const graphUtil = require('../hb/util');
var VectorClock = require('./VectorClock');
const logger = require('../../../driver/logger.js').logger;

class Analyzer {
    constructor (appPath) {
        this.appPath = appPath;
        this.hbfile = path.resolve(appPath, './ascii-trace.hb-full.json');
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

        this.relations = info.relations;
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
        else {
            let t = new VectorClock(this.task_num);
            return t;
        }
    }

    findVC (eid) {
        return this.vcs[eid] ? this.vcs[eid] : null;
    }

    analysis () {
        this.buildVCs();
        this.visualizeVCs();
    }

    buildVCs () {
        let events = this.asyncObjects.getAll();

        for (let i = 0; i < events.length; i++) {
            let ei = events[i].id
            //console.log('buildVCs: ei ', ei);
            let hbevents = [];
            for (let j = 0; j < i; j++) {
                let ej = events[j].id;
                //console.log('buildVCs: ei, ej ', ei, ej);
                if (this.relations.has(ej, ei)) hbevents.push(ej);
            }
            this.createVC(hbevents, ei);
        }
    }

    //Create a vector clock based on hb edges
    createVC (hbevents, e) {
        if (hbevents.length == 0) return;
        let vcs = [];
        hbevents.forEach(event => {
            let vc = this.findOrCreateVC(event);
            if (!vc) {
                logger.debug('createVC: missing vc');
                return;
            }
            vcs.push(vc);
        });
        let vc = VectorClock.inct(vcs, this.task_num);
        this.vcs[e] = vc;
    }

    isHB (e1, e2) {
        let vc1 = this.findVC(e1);
        let vc2 = this.findVC(e2);
        
        return VectorClock.compare(vc1, vc2) ? true : false;
    }

    visualizeVCs () {
        var vcfile = path.resolve(this.appPath, './vc.json');
        //console.log(vcfile);
        var flatten_vcs = {};
        for (let e in this.vcs) {
            flatten_vcs[e] = VectorClock.stringify(this.vcs[e]);
        }
        fs.writeFileSync(vcfile, JSON.stringify(flatten_vcs, null, 4), 'utf-8');
    }
}

module.exports = Analyzer;