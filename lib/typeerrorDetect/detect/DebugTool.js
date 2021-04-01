const { appendFile } = require('fs');
const path = require('path');
const graphUtil = require('../hb/util');

class Tool {
    constructor (appPath) {
        this.appPath = appPath;
        this.hbfile = path.resolve(appPath, './ascii-trace.hb-full.json');
        this.recordfile = path.resolve(appPath, './ascii-trace.access-records.json');
        this.actionsfile = path.resolve(appPath, './ascii-trace.actions.json');
        let info = graphUtil.read(this.hbfile, this.recordfile, this.actionsfile);
        this.asyncObjects = info.asyncObjects;
        this.hbgraph = info.relations;
        this.edges = info.relations.hb;
    }

    getCbChain (eid) {
        let backward = [];
        let events = this.asyncObjects.getAll();
        let e = events.find(e => e.id == eid);

        while (e) {
            backward.push(e.id);
            e = events.find(event => event.id === e.prior);
        }

        backward.reverse();
        console.log(backward.join('->'));
    }

    getCbPath (src, dest) {
        let path = [];
        let edges = [];
        this.hbgraph.startGraphLibDataStructure();

        let _path = this.hbgraph.getPath(src,dest);
        path = _path ? _path : [];
        //console.log(path)

        if (path.length >= 2) {
            for (let i = 1; i < path.length; i++) {
                let edge = this.edges.find(arc => arc.fore == path[i - 1] && arc.later == path[i]);
                edges.push(edge.type);
            }
        }

        //console.log(path.join('->'));
        let information = '';
        if (path.length >= 2) {
            for (let i = 0; i < path.length - 1; i++) {
                information += path[i];
                information += ' (' + edges[i];
                information += ') ->';
            }
        }

        console.log(information);
    }

    countExperiemtalResult () {
        let event_num = 0;
        let action_num = 0;
        let op_num = 0;

        event_num = this.asyncObjects.getAll().length;

        let actionfile = path.resolve(this.appPath, './ascii-trace.actions.json');
        let actions = graphUtil.readAction(actionfile).actions;
        action_num = actions.length;

        let operationfile = path.resolve(this.appPath, './ascii-trace.access-records.json');
        let records = graphUtil.readOperation(operationfile).records;
        op_num = records.getAll().length;

        let info = '';

        info += 'event_num: ' + event_num + '\n';
        info += 'action_num: ' + action_num + '\n';
        info += 'op_num: ' + op_num + '\n';

        console.log(info);
    }
}

module.exports = Tool;