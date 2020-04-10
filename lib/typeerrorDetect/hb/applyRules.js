function applyRules (asyncObjs, relations) {
    let eventNum = asyncObjs.getNum();
    var events = asyncObjs.getAll();

    for (var i = 0; i < eventNum; i++) {
        var ei = events[i];
        //if (isSkipForDebug(ei, ['10', '14'])) continue;
        for (var j = 0; j < eventNum; j++) {
            if (j === i) continue;
            var ej = events[j];
            //if (isSkipForDebug(ej, ['10', '14'])) continue;
            relations.isEventHB(ei, ej);
            //buildEventHB(asyncObjs, ei, ej, relations);
        }
    }

    /*if (opts.promiseRace) {
        dealWithPromiseRace (events, relations);
    }*/
};

function isSkipForDebug(e, skipIds) {
    for (var i = 0; i < skipIds.length; i++) {
        //console.log('isSkip: %s', JSON.stringify(e));
        if (e.id == skipIds[i])
            return true;
    }
    return false;
}

function dealWithPromiseRace (events, relations) {

};

module.exports = applyRules;