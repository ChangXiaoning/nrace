class Relations {
    constructor () {
        this.hb = new Array();
    }

    add (fore, later, type) {
        this.hb.push({fore, later, type});
    }

    happensBefore (opi, opj) {
        
    }

    isOpHB (opi, opj) {
        if (event(opi) == event(opj)){
            return lineno(opi) < lineno(opj);
        } else {
            return isEventHB(event(opi), event(opj));
        }
    }
}

module.exports = Relations;