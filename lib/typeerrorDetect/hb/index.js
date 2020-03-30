var fs = require('fs'),
    Relations = require('./Relations'),
    applyRules = require('./applyRules'),
    graphviz = require('./graphViz');

function buildHBGraph (args) {
    var events = args.events;

    var relations = new Relations();
    var opts = {};
    applyRules(events, relations, opts);

    //write hb results into files
    let hbFileName = args.file.replace('.log', '.hb-full.json')
    console.log(hbFileName);
    fs.writeFileSync(hbFileName, JSON.stringify({events, relations}));

    //visualize hb graph
    if (args.image) {
        let figName = args.file.replace('.log', 'hb-graph-full.png');
        graphviz.drawGraph(figName)
    }
}