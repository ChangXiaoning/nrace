const fs = require('fs');
const Relations = require('./Relations');
const applyRules = require('./applyRules');
const graphviz = require('./graphViz');
const reduceGraph = require('./reduceGraph');

function buildHBGraph (args) {
    var asyncObjects = args.asyncObjects,
        promiseAllSet = args.promiseAllSet,
        promiseRaceSet = args.promiseRaceSet;

    var relations = new Relations(asyncObjects, promiseAllSet, promiseRaceSet);
    applyRules._applyRules(asyncObjects, relations);

    //reduced graph only with callback nodes
    let rg = reduceGraph(asyncObjects, relations);

    //write hb results into files
    let hbFileName = args.file.replace('.log', '.hb-full.json')
    console.log(hbFileName);
    //fs.writeFileSync(hbFileName, JSON.stringify({ relations }, null, 4), 'utf-8');
    fs.writeFileSync(hbFileName, JSON.stringify({
        objects: relations.asyncObjs.getAll(),
        hb: relations.hb,
    }, null, 4), 'utf-8');

    let reducedHbFileName = args.file.replace('.log', '.hb.json');
    console.log(reducedHbFileName);
    fs.writeFileSync(reducedHbFileName, JSON.stringify({
        objects: rg.asyncObjects.getAll(),
        relations: rg.relations.hb,
    }, null, 4), 'utf-8');

    //visualize hb graph
    if (args.image) {
        let figName = args.file.replace('.log', '.hb-graph-full.png');
        console.log(figName);
        graphviz.drawGraph(figName, {nodes: asyncObjects.getAll(), edges: relations.hb});
        
        figName = args.file.replace('.log', '.hb-graph-only-cbs.png');
        console.log(figName);
        graphviz.drawGraph(figName, { nodes: rg.asyncObjects.getAll(), edges: rg.relations.hb });
    }

    return { hbFileName: hbFileName, relations: relations, rg: rg.relations};
}

module.exports = buildHBGraph;