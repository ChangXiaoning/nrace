var fs = require('fs');
const AsyncObjects = require('./AsyncObjects');

class ActionManager {
    constructor () {
        this.actions = [];
    }

    push (action) {
        this.actions.push(action);
        return action;
    }

    extract () {
        return this.actions;
    }

    /**
     * Public: compute iid & location for fs records and actions
     * @param {*} records 
     */
    ready (records) {
        records = records.getAll();
        //deal with sync fs records
        for (let record of records) {
            if(record.isAsync == '0') {
                let fs_lineno = record.fs_lineno; 
                for (let backtrack = 1; fs_lineno - backtrack > 1 ; backtrack++) {
                    let rcd = records.find(r => r.lineno == fs_lineno - backtrack);
                    if (!rcd) break;
                    //console.log("BACK: %d", rcd.lineno);
                    if (rcd.event != record.event)
                        break;
                    if (rcd.iid)
                        record.iid = rcd.iid;
                        record.location = rcd.location;
                        record.cbLoc = rcd.cbLoc;
                }
            }
        }
        //deal with async fs (actions)
        for (let action of this.actions) {
            let fs_lineno = action.lineno; 
            //console.log(fs_lineno)
                for (let backtrack = 1; fs_lineno - backtrack >= 1 ; backtrack++) {
                    //console.log('back: %d', backtrack)
                    let rcd = records.find(r => r.lineno == fs_lineno - backtrack);
                    if (!rcd) continue;
                    //console.log("BACK: %d", rcd.lineno);
                    if (rcd.event != action.event)
                        break;
                    if (rcd.iid)
                        action.iid = rcd.iid;
                        action.location = rcd.location;
                        action.cbLoc = rcd.cbLoc;
                }
        }
        return new AsyncObjects(records);
    }

    store (hbFileName) {
        let actionFileName = hbFileName.replace('.hb-full.json', '.actions.json')
        //console.log(recordFileName);
        let actions = this.actions;
        fs.writeFileSync(actionFileName, JSON.stringify({ actions }, null, 4), 'utf-8');
    }
}

module.exports = ActionManager;