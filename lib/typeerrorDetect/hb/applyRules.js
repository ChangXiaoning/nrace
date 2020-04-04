function applyRules (asyncObjs, relations) {
    let eventNum = asyncObjs.getNum();
    var events = asyncObjs.getAll();

    for (var i = 0; i < eventNum; i++) {
        var ei = events[i];
        for (var j = 0; j < eventNum; j++) {
            if (j === i) continue;
            var ej = events[j];
            relations.isEventHB(ei, ej);
            //buildEventHB(asyncObjs, ei, ej, relations);
        }
    }

    /*if (opts.promiseRace) {
        dealWithPromiseRace (events, relations);
    }*/
};

function dealWithPromiseRace (events, relations) {

};

module.exports = applyRules;