class Relations {
    constructor () {
        this.hb = new Array();
    }

    add (fore, later, type) {
        this.hb.push({fore, later, type});
    }

    happensBefore (opi, opj) {
        
    }
}

module.exports = Relations;