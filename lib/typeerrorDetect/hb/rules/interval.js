//get the event that should happen before the given event according to
//interval hb rule
//Note: we only deal with the last event happens before the given
//event since other events are already ordered by interval rule
function apply(intervalHB, e){
    let result = [];
    if (e.type === 'Timeout'){
        let metedata = e.id.split('-'),
            base = metedata[0],
            offset = metedata[1] ? parseInt(metedata[1]) : 1;
        for (let key in intervalHB) {
            if (base != key) continue;
            let idx = intervalHB[key].indexOf(e.id);
            //if (idx == 0) result.push(key);
            //else if (idx > 0) result.push(intervalHB[idx - 1]);
            if (idx > 0) { result.push(intervalHB[idx - 1]); break }
        }
    }
    return result;
}

function buildIntervalHB (asyncObjects) {
    let intervals = asyncObjects.getAll().filter(e => e.type == 'Timeout');
    let intervalHB = {};
    
    for (let i = 0; i < intervals.length - 1; i++) {
        let metedatai = intervals[i].id.split('-'),
            basei = metedatai[0],
            offseti = metedatai[1] ? parseInt(metedatai[1]) : 1;
        for (let j = i + 1; j < intervals.length; j++) {
            let metedataj = intervals[j].id.split('-'),
                basej = metedataj[0],
                offsetj = metedataj[1] ? parseInt(metedataj[1]) : 1;
            if (basei == basej && offseti < offsetj) {
                intervalHB[basei] = intervalHB[basei] ? intervalHB[basei] : [intervals[i].id];
                intervalHB[basei].push(intervals[j].id);
            }
        }
    }
    return intervalHB;
}

function _apply (asyncObjects, relations) {
    let intervals = asyncObjects.getAll().filter(e => e.type == 'Timeout');
    
    for (let i = 0; i < intervals.length - 1; i++) {
        let metedatai = intervals[i].id.split('-'),
            basei = metedatai[0],
            offseti = metedatai[1] ? parseInt(metedatai[1]) : 1;
        for (let j = i + 1; j < intervals.length; j++) {
            let metedataj = intervals[j].id.split('-'),
                basej = metedataj[0],
                offsetj = metedataj[1] ? parseInt(metedataj[1]) : 1;
            if (basei == basej && offseti < offsetj) 
                relations.add(intervals[i].id, intervals[j].id, 'interval');
        }
    }
}

module.exports = { apply, _apply, buildIntervalHB };