const globalfifo = require('./globalfifo');
const globaltimeout = require('./globaltimeout');
const nextTick = require('./nextTick');

function apply (asyncObjects, relations) {
    let events = asyncObjects.getAll();
    for (let i = 0; i < events.length - 1; i++) {
        let ea = events[i];
        for (let j = i + 1; j < events.length; j++) {
            let eb = events[b];

            //same type
            if (ea.type == eb.type &&
                !relations.happensBefore(ea.id, eb.id) &&
                !relations.happensBefore(eb.id, ea.id)) {
                switch(ea.type) {
                    case 'Immediate':
                    case 'TickObject':
                    case 'PROMISE':
                        globalfifo.apply(asyncObjects, relations, ea, eb);
                        break;
                    case 'Timeout':
                        globaltimeout.apply(asyncObjects, relations, ea, eb);
                        break;
                }
            }

            //nexttick
            if (isOneOfTick(ea, eb) &&
                !relations.happensBefore(ea.id, eb.id) &&
                !relations.happensBefore(eb.id, ea.id)) {
                nextTick.apply(asyncObjects, relations, ea, eb);
            }
            
        }
    }
}

function isOneOfTick(aoi, aoj) {    //different types, but one is tick
    let itype = aoi.entry.type, jtype = aoj.entry.type;
    return itype !== jtype && (itype === 'TickObject' || jtype === 'TickObject');
}

module.exports = { apply }