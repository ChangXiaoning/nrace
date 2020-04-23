function apply(asyncObjects, ei, ej, relations){
    if (ei.type === ej.type && ej.type === 'Timeout'){
        if (ei.prior === ej.prior) {
            let metedatai = ei.id.split('-'),
                metedataj = ej.id.split('-'),
                basei = metedatai[0],
                basej = metedataj[0],
                offseti = metedatai[1] ? metedatai[1] : 1,
                offsetj = metedataj[1] ? metedataj[1] : 1;
            if (basei === basej && offseti < offsetj) {
                relations.add(ei.id, ej.id, 'interval');
                return true;
            }
        }
    }
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

module.exports = { apply, _apply };