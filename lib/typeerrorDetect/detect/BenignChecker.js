const { SSL_OP_NO_TLSv1_1 } = require('constants');
const path = require('path');
const graphUtil = require('../hb/util');
const Prefix = '*U*';
const Prefix_True = Prefix + 'T';
const Prefix_False = Prefix + 'F';

class BenignChecker {
    /**
     * 
     * @param {*} rg 
     * @param {*} asyncObjects 
     * @param {*} records 
     * @param {*} appPath 
     * @param {Number} conditionalBacktrackNum: default to 5
     */
    constructor (asyncObjects, records, appPath, conditionalBacktrackNum, relations) {
        this.asyncObjects = asyncObjects;
        this.records = records;
        this.fullhbfile = path.resolve(appPath, './ascii-trace.hb-full.json');
        this.conditionalBacktrackNum = conditionalBacktrackNum;
        // lock structure: {name (name OR <base, property>), checkEntryType, checkLineno, checkEvent,
        // lockLineno, lockEvent, unlockLineno, unlockEvent}
        this.locks = [];
        this.LockType = {
            "C": "Check",
            "L": "Lock",
            "U": "Unlock",
        };
        this.accumulatorType = {
            "L": "LeftRead",
            "R": "RightRead",
            "W": "ResultWrite"
        };
        this.fullHBGraph = relations;
        //this.init();
    }

    init () {
        this.fullHBGraph = graphUtil.readFullHB(this.fullhbfile);
        //console.log('complete full')
    }

    analysis (reports) {
        let me = this;
        this.identifyCandidateLockInCheck();
        this.identifyCandidateLockInUnlock();
        this.findBinary();
        this.identifyCandidateLockInCheck(false);
        this.start(reports);
    }

    /**
     * Find `Check` operation in the same (or in the prior) event with the one where
     * async task is invoked.
     * Require: 
     * 1) `Check` is a reading operation
     * 2) reading operation writes Boolean type value (TODO: add record)
     */
    identifyCandidateLockInCheck (isBoolean) {
        isBoolean = typeof isBoolean === 'undefined' ? true : false;
        let me = this;
        this.locksInCheck = [];
        let records = this.records.getAll();
        let MaxBacktrack = this.conditionalBacktrackNum;
        for (let record of records) {
            let entryType = record.entryType;
            if (entryType == "CONDITIONAL") {
                let count = 0;
                //if (record.name == 'eof')
                    //console.log("CON: %d", record.lineno);
                for (let back = 1; count <= MaxBacktrack && record.lineno - back >= 1; back++) {
                    let rcd = records.find(r => r.lineno == record.lineno - back);
                    //make READ and CONDITIONAL in the same event
                    if (!rcd) break;
                    //console.log("BACK: %d", rcd.lineno);
                    if (rcd.event != record.event)
                        break;
                    let booleanCond = isBoolean ? equalsToBoolean(rcd.val) : true;
                    if (booleanCond) {
                        //satisfy 2)
                        let exist = me.locksInCheck.find(l => l.checkLineno == rcd.lineno);
                        if (exist) break;
                        switch (rcd.entryType) {
                            case "READ":
                                me.locksInCheck.push({
                                    name: rcd.name,
                                    checkLineno: rcd.lineno,
                                    checkEvent: rcd.event, 
                                });
                                count++;
                                break;
                            case "GETFIELD":
                                me.locksInCheck.push({
                                    name: rcd.name,
                                    prop: rcd.prop,
                                    checkLineno: rcd.lineno,
                                    checkEvent: rcd.event,
                                });
                                count++;
                                break;
                        }
                    }
                }
            }
        }
    }

    /**
     * Find `Lock` operation in the same (or in the prior) event with the one where
     * async task is invoked.
     * Require: 
     * 1) `Lock` happen after `Check` and
     * 2) `Lock` happen before async invocation and
     * 3) `Lock` is a writing operation
     * 4) `Lock` has the same `name` with `Check`
     * 5) writing operation writes Boolean type value (TODO: add record)
     */
    identifyCandidateLockInLock () {
        let me = this;
        this.lockBetweenCheckAndLock = [];
        let events = this.asyncObjects.getAll();
        for (let lock in me.locksInCheck) {
            for (let event of events) {
                let path = me.fullHBGraph.getRegistrationPath(lock.checkEvent, event);
                if (path.length > 0) {
                    //satisfy 1) & 2)
                    for (let intermediateEvent of path) {
                        //check 3) & 4)
                        let conditionalRcd = me.records.getAll().find(rcd => rcd.lineno == lock.checkLineno);
                        let writingOperations = me.records.getAll().filter(rcd =>
                            rcd.event == intermediateEvent && rcd.name == conditionalRcd.name && 
                            ["WRITE", "PUTFIELD"].indexOf(rcd.entryType) > -1 && equalsToBoolean(rcd.val));
                        if (writingOperations.length > 0) {
                            let candidateLocks = [];
                            switch (conditionalRcd.entryType) {
                                case "READ":
                                    candidateLocks = writingOperations
                                        .filter(rcd => rcd.entryType == "WRITE")
                                        .map (rcd => {
                                            me.lockBetweenCheckAndLock.push({
                                                name: conditionalRcd.name,
                                                checkLineno: conditionalRcd.lineno,
                                                checkEvent: conditionalRcd.event,
                                                lockLineno: rcd.lineno,
                                                lockEvent: rcd.event,
                                            });
                                        });

                                    break;
                                case "GETFIELD":
                                    candidateLocks = writingOperations
                                        .filter(rcd => rcd.entryType == "PUTFIELD")
                                        .map(rcd => {
                                            me.lockBetweenCheckAndLock.push({
                                                name: conditionalRcd.name,
                                                prop: conditionalRcd.prop,
                                                checkLineno: conditionalRcd.lineno,
                                                checkEvent: conditionalRcd.event,
                                                lockLineno: rcd.lineno,
                                                lockEvent: rcd.event,
                                            });
                                        });
                                    break;
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Find `Unlock` operations in the same (or in the children) event
     * with the one where async task is invoked.
     * Require:
     * 1) `Unlock` happen after `Lock` and 
     * 2) `Unlock` happen after async invocation and
     * 3) `Unlock` is not in the same event with async invocation
     * 4) `Unlock` is a writing operation
     * 5) `Unlock` has the same `name` with `Check` and `Lock`
     * 6)  writing operation writes Boolean type value (TODO: add record)
     */
    identifyCandidateLockInUnlock () {
        let lockCountID = 0;
        let me = this;
        this.lockBetweenCheckAndUnlock = [];
        let events = this.asyncObjects.getAll();

        for (let lock of me.locksInCheck) {
            //if (lock.name == '303' && lock.prop == 'readyState')
                //console.log('debug');
            let name = lock.name;
            //check 4) & 5) & 6)
            //`Lock` can be in the same event with `Check`
            let writingOperation = me.records.getAll()
                                                .filter(rcd => rcd.name == name && ["WRITE", "PUTFIELD"].indexOf(rcd.entryType) > -1 && equalsToBoolean(rcd.val))
            if (lock.prop)
                writingOperation = writingOperation.filter(rcd => rcd.prop == lock.prop);
            //check 1) & 2) & 3)
            if (writingOperation.length >= 2) {
                writingOperation.sort(compare('lineno'));
                //Skip the event `1`
                for (let i = 1; i < writingOperation.length; i++) {
                    let unlockWrt = writingOperation[i];
                    let path = me.fullHBGraph.getRegistrationPath(lock.checkEvent, unlockWrt.event);
                    //`Lock` can be in the same event with `Check`
                    if (path.length >= 2) {
                        for (let j = 0; j < i; j++) {
                            if (i == j) continue;
                            let lockWrt = writingOperation[j];
                            let idx = path.indexOf(lockWrt.event);
                            if (idx > -1)
                                if (lock.prop)
                                    me.locks.push({
                                        id: ++lockCountID,
                                        name: name,
                                        prop: lock.prop,
                                        checkLineno: lock.checkLineno,
                                        checkEvent: lock.checkEvent,
                                        lockLineno: lockWrt.lineno,
                                        lockEvent: lockWrt.lockEvent,
                                        unlockLineno: unlockWrt.lineno,
                                        unlockEvent: unlockWrt.event,
                                    });
                                else
                                    me.locks.push({
                                        id: ++lockCountID,
                                        name: name,
                                        prop: lock.prop,
                                        checkLineno: lock.checkLineno,
                                        checkEvent: lock.checkEvent,
                                        lockLineno: lockWrt.lineno,
                                        lockEvent: lockWrt.lockEvent,
                                        unlockLineno: unlockWrt.lineno,
                                        unlockEvent: unlockWrt.event,
                                    });
                        }
                    } else if (path.length == 1) {
                        if (lock.prop)
                            me.locks.push({
                                id: ++lockCountID,
                                name: name,
                                prop: lock.prop,
                                checkLineno: lock.checkLineno,
                                checkEvent: lock.checkEvent,
                                lockLineno: unlockWrt.lineno,
                                lockEvent: unlockWrt.lockEvent,
                                unlockLineno: unlockWrt.lineno,
                                unlockEvent: unlockWrt.event,
                            });
                        else
                            me.locks.push({
                                id: ++lockCountID,
                                name: name,
                                prop: lock.prop,
                                checkLineno: lock.checkLineno,
                                checkEvent: lock.checkEvent,
                                lockLineno: unlockWrt.lineno,
                                lockEvent: unlockWrt.lockEvent,
                                unlockLineno: unlockWrt.lineno,
                                unlockEvent: unlockWrt.event,
                            });
                    }
                }
            }
        }
    }

    start (reports) {
        for (let report of reports) {
            let opi = report.tuple[0];
            let opj = report.tuple[1];
            let benignInfo = null;
            let checkResult = this.isBenign(opi, opj)
            if (checkResult) 
                benignInfo = {
                    benignPattern: "intention",
                    //type: [checkResult.typei, checkResult.typej],
                }
            //check Accumulator pattern
            else {
                checkResult = this.checkAccumulationPattern(opi, opj);
                if (checkResult)
                    benignInfo = {
                        benignPattern: 'accumulator',
                        //type: [checkResult.typei, checkResult.typej],
                    }
                else {
                    //check Check-Accumulator pattern
                    checkResult = this.checkAccumulationAndCheckPattern(opi, opj);
                    if (checkResult.res)
                        benignInfo = {
                            benignPattern: 'check-accumulator',
                            type: [checkResult.typei, checkResult.typej],
                        }
                    }
            }
            if (opi.val == opj.val && opi.valIsObject == opj.valIsObject && !opi.resource) {
                benignInfo = {
                    benignPattern: 'same-value',
                    type: [opi.entryType, opj.entryType],
                };
            }
            report.benignInfo = benignInfo;
        }
    }

    /**
     * Check the detected race (opi, opj) is a benign race.
     * @param {Record} opi
     * @param {Record} opj
     * @returns {Boolean}: true | false
     */
    isBenign (opi, opj) {
        let res = {};
        /*let _res = false;
        //if (opi.lineno == 174)
            //console.log("isBenign: %d, %d", opi.lineno, opj.lineno);
        let ideni = this.identifyOperation(opi);
        let idenj = null;
        if (ideni.id > 0) {
            idenj = this.identifyOperation(opj);
            if (ideni.id == idenj.id) _res = true;
        }
        res.res = _res;
        if (res.res) {
            res.typei = ideni.type;
            res.typej = idenj.type;
        }
        return res;*/

        let found = false;
        for (let lock of this.locks) {
            if (lock.name == opi.name && lock.prop == opi.prop) {found = true; break;}
        }

        return found;
    }

    /**
     * Given the operation, identify it is `Check`, `Lock` or `Unlock`
     * Require:
     * 1) same name
     * 2) same location (same iid)
     * @param {Operation} op 
     * @returns 
     */
    identifyOperation (op) {
        let type = null;
        let lockID = -1;
        let me = this;
        switch (op.entryType) {
            case "READ":
            case "GETFIELD":
                //check `Check`
                for (let lock of me.locks) {
                    if (lock.name != op.name) continue;
                    if (lock.prop && lock.prop != op.prop) continue;
                    let checkIID = me.records.getAll().find(rcd => rcd.lineno == lock.checkLineno).iid;
                    if (checkIID != op.iid) continue;
                    type = me.LockType["C"];
                    lockID = lock.id;
                    break;
                }
                break;
            case "WRITE":
            case "PUTFIELD":
                //check `Lock` and `Unlock`
                for (let lock of me.locks) {
                    if (lock.name != op.name) continue;
                    if (lock.prop && lock.prop != op.prop) continue;
                    let lockIID = me.records.getAll().find(rcd => rcd.lineno == lock.lockLineno).iid;
                    if (lockIID == op.iid) {
                        type = me.LockType["L"];
                        lockID = lock.id;
                        break;
                    }
                    let unlockIID = me.records.getAll().find(rcd => rcd.lineno == lock.unlockLineno).iid;
                    if (unlockIID == op.iid) {
                        type = me.LockType["U"];
                        lockID = lock.id;
                        break;
                    }
                }
                break;
        }
        return {type: type, id: lockID};
    }

    findBinary () {
        this.accumulator = [];
        let counter = 0;
        let me = this;
        let binaries = this.records.getAll()
                                    .filter(rcd => rcd.entryType === "BINARY");
        
        for (let binary of binaries) {
            if (me.isPatternExist(binary.iid)) continue;
            //corner case
            //if (binary.lineno == 1042)
            //console.log('findBinary lineno: %d', binary.lineno);
            let wrcd = this.records.getAll()
                                    .find(rcd => rcd.lineno == binary.lineno + 1);
            //corner case: it is possible that no write for binary
            //operation, e.g., setTimeout(..., time*1000);
            if (!wrcd) continue;
            if (["WRITE", "PUTFIELD"].indexOf(wrcd.entryType) < 0)
                continue;
            //find left or right operand read before
            //console.log('binary lineno: %d', binary.lineno);
            //if (binary.iid == 130)
                //console.log('debug');
            //if (binary.lineno == 2997)
                //console.log('debug');
            let sameEventRecords =  this.records.getAll()
                                                .filter(rcd => rcd.event == binary.event && rcd.valIsObject == 'false');
            let candidateReads = sameEventRecords.filter(rcd => ["READ", "GETFIELD"].indexOf(rcd.entryType) > -1 && rcd.lineno < binary.lineno);
            //find left operand
            let candidateLeftOperands = candidateReads.filter(rcd => rcd.val == binary.left);
            let leftOp = candidateLeftOperands.length > 0 ? candidateLeftOperands[candidateLeftOperands.length - 1] : null;
            //find right operand
            let candidateRightOperands = candidateReads.filter(rcd => rcd.val == binary.right);
            let rightOp = candidateRightOperands.length > 0 ? candidateRightOperands[candidateRightOperands.length - 1] : null;
            
            //it is possible that only have one operand reading record
            if (!leftOp && !rightOp) continue;
            //corner case: it is possible that `left` is same to `right`
            if (leftOp && rightOp && leftOp.lineno > rightOp.lineno) continue;

            //it is possible only has left or right operand
            //try to match left operand with result writing
            let candidateResultOperations = null;
            if (leftOp) {
                candidateResultOperations = sameEventRecords.filter(rcd => rcd.name == leftOp.name && rcd.val == binary.result && rcd.lineno > binary.lineno);
                if (leftOp.prop)
                    candidateResultOperations = candidateResultOperations.filter(rcd => rcd.prop == leftOp.prop && rcd.entryType == 'PUTFIELD');
            } else if (rightOp) {
                //try to match right operand with result writing
                candidateResultOperations = sameEventRecords.filter(rcd => rcd.name == rightOp.name && rcd.val == binary.result && rcd.lineno > binary.lineno);
                if (rightOp.prop)
                    candidateResultOperations = candidateResultOperations.filter(rcd => rcd.prop == rightOp.prop && rcd.entryType == 'PUTFIELD');
            }
            let resultOp = candidateResultOperations && candidateResultOperations.length > 0 ? candidateResultOperations[0] : null;
            
            //MATCH LEFT!
            if (resultOp) {
                me.accumulator.push({
                    id: ++counter,
                    name: leftOp.name,
                    prop: leftOp.prop ? leftOp.prop : null,
                    leftIID: leftOp.iid,
                    rightIID: null,
                    binaryIID: binary.iid,
                    resWIID: resultOp.iid,
                });
                continue;
            } else {
                //match right operand with result writing
                if (!rightOp) continue;
                candidateResultOperations = sameEventRecords.filter(rcd => rcd.name == rightOp.name && rcd.val == binary.result);
                if (rightOp.prop)
                    candidateResultOperations = candidateResultOperations.filter(rcd => rcd.prop == rightOp.prop && rcd.entryType == 'PUTFIELD');
                resultOp = candidateResultOperations.length > 0 ? candidateResultOperations[0] : null;
                //MATCH RIGHT!
                if (resultOp)
                    me.accumulator.push({
                        id: ++counter,
                        name: rightOp.name,
                        prop: rightOp.prop ? rightOp.prop : null,
                        leftIID: null,
                        rightIID: rightOp.iid,
                        binaryIID: binary.iid,
                        resWIID: resultOp.iid,
                    });
            }
        }
    }

    isPatternExist (binaryIID) {
        let res = false;
        let exist = this.accumulator.find(a => a.binaryIID === binaryIID);
        if (exist) res = true;
        return res;
    }

    /**
     * Check the detected race (opi, opj) is a benign race.
     * @param {Record} opi
     * @param {Record} opj
     * @returns {Boolean}: true | false
     */
    checkAccumulationPattern (opi, opj) {
        /*let res = {};
        let _res = false;

        let ideni = this.identifyAccumulator(opi);
        let idenj = null;
        if (ideni.id > 0) {
            idenj = this.identifyAccumulator(opj);
            if (idenj.id > 0 && ideni.name === idenj.name && ideni.prop == idenj.prop)
                _res = true;
        }
        res.res = _res;
        if (res.res) {
            res.typei = ideni.type;
            res.typej = idenj.type;
        }*/

        let res = false;
        for (let accumulator of this.accumulator) {
            if (accumulator.name == opi.name && accumulator.prop == opi.prop) {
                res = true;
                break;
            }
        }
        return res;
    }

    /**
     * Given the operation, identify it is `Check`, `Lock` or `Unlock`
     * Require:
     * 1) same name
     * 2) same location (same iid)
     * @param {Operation} op 
     * @returns 
     */
    identifyAccumulator (op) {
        let type = null;
        let accumulatorID = -1;
        let name = null;
        let prop = null;
        let me = this;

        if (['READ', 'GETFIELD', 'WRITE', 'PUTFIELD'].indexOf(op.entryType) > -1) {
            for (let accumulator of me.accumulator) {
                if (accumulator.name !== op.name) continue;
                if (accumulator.prop && accumulator.prop !== op.prop) continue;
                //check `Read`
                if (['READ', 'GETFIELD'].indexOf(op.entryType) > -1) {
                    if (op.iid === accumulator.leftIID) {
                        type = me.accumulatorType['L'];
                        accumulatorID = accumulator.id;
                        name = accumulator.name;
                        prop = accumulator.prop;
                        break;
                    } else if (op.iid === accumulator.rightIID) {
                        type = me.accumulatorType['R'];
                        accumulatorID = accumulator.id;
                        name = accumulator.name;
                        prop = accumulator.prop;
                        break;
                    }
                } else {
                    //check `Write`
                    if (op.iid === accumulator.resWIID) {
                        type = me.accumulatorType['W'];
                        accumulatorID = accumulator.id;
                        name = accumulator.name;
                        prop = accumulator.prop;
                        break;
                    }
                }
            }
        }
        
        return {type: type, id: accumulatorID, name: name, prop: prop};
    }

    /**
     * Assume opi is `Read`, which can be a reading operation in CONDITIONAL
     * opj is `Write`, which can be writing operation in Accumulator
     * to write result back
     * @param {*} opi 
     * @param {*} opj
     */
    _checkAccumulationAndCheckPattern (opi, opj) {
        let res = {};
        let _res = false;
        let me = this;

        let ideni = this.identifyCondition(opi);
        let idenj = null;
        if (ideni && ideni.type === this.LockType["C"]) {
            idenj = this.identifyAccumulator(opj);
            if (idenj && idenj.type === this.accumulatorType["W"])
                _res = true;
        }

        res.res = _res;
        if (res.res) {
            res.typei = ideni.type;
            res.typej = idenj.type;
        }
        return res;
    }

    checkAccumulationAndCheckPattern (opi, opj) {
        let falseRet = {res: false};
        if (opi.entryType === opj.entryType)
            return falseRet;
        else if (["READ", "GETFIELD"].indexOf(opi.entryType) > -1)
            return this._checkAccumulationAndCheckPattern(opi, opj);
        else
            return this._checkAccumulationAndCheckPattern(opj, opi);
    }

    identifyCondition (op) {
        let type = null;
        let lockID = -1;
        let me = this;
        switch (op.entryType) {
            case "READ":
            case "GETFIELD":
                //check `Check`
                for (let lock of me.locksInCheck) {
                    if (lock.name != op.name) continue;
                    if (lock.prop && lock.prop != op.prop) continue;
                    let checkIID = me.records.getAll().find(rcd => rcd.lineno == lock.checkLineno).iid;
                    if (checkIID != op.iid) continue;
                    type = me.LockType["C"];
                    lockID = lock.id;
                    break;
                }
                break;
        }
        return {type: type, id: lockID};
    }
}

function equalsToBoolean (val) {
    return val && val.startsWith(Prefix);
    //return val && (val.startsWith(Prefix_True) || val.startsWith(Prefix_False));
}

function compare (p) {
    return function (m, n) {
        let a = m[p];
        let b = n[p];
        return a - b;
    }
}

module.exports = BenignChecker;