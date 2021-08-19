//check if aoi happens before aoj according to two action rules
//In our tool aoi is an event, aoj is an async task
function apply (aoi, aoj, relations) {
    //event aoi offloads asyncTask aoj
    if (aoj.event == aoi.id)
        relations.add(aoi.id, aoj.id, 'action-1');
    
    if (aoj.callback == aoi.id)
        relations.add(aoj.id, aoi.id, 'action-2');
}

function isAsyncTask (ao) {
    return ['C', 'D', 'O', 'X', 'R', 'W', 'S'].indexOf(ao.entryType) > -1;
}

module.exports = {apply};