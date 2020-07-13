class Checker {
    constructor (reports) {
        this.reports = reports;
        this.suspiciousPointers = new Set();
        //id -> pointers <Array>
        this.id2pointerMap = new Map()
    }

    getSuspiciousPointers () {
        for (let rpt of this.reports) {
            for (let pointer of rpt.pointers) {
                this.suspiciousPointers.add(pointer);
            }
            this.id2pointerMap.set(rpt.id, rpt.pointers);
        }
    }
}