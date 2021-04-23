const _ = require('lodash');

const registrationRule = require('./rules/registration');
const intervalRule = require('./rules/interval');
const resolveRule = require('./rules/resolve');

const AsyncObjects = require('../asyncobjects');

function findIdle (events, records) {
    let idle = [];
    for (let event of events) {
        if (event.type == 'TickObject') {
            let later = null;
            //registration
            later = events.find(e => e.prior == event.id);
            if (later) continue;
            //fix bug: event can be the last event, it does not
            //register any event but also operates some resource
            let rcd = records.find(r => r.event == event.id);
            if (rcd) continue;
            
            idle.push(event.id);
        }
    }
    
    console.log('idle (%d): %s', idle.length, idle);
    _.remove(events, e => {return idle.indexOf(e.id) > -1});
    return new AsyncObjects(events);
}

module.exports = findIdle;