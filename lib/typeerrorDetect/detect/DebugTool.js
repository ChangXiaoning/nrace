const path = require('path');
const graphUtil = require('../hb/util');

class Tool {
    constructor (appPath) {
        this.hbfile = path.resolve(appPath, './ascii-trace.hb-full.json');
        let info = graphUtil.read(this.hbfile);
        this.asyncObjects = info.asyncObjects;
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
}

module.exports = Tool;