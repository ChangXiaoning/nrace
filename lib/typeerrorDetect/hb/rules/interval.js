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
            }
        }
    }
}

module.exports = { apply }