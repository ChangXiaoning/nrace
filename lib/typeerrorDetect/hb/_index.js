const fs = require('fs');
const Relations = require('./Relations');
const applyRules = require('./applyRules');
const newApplyRules = require('./_newApplyRules');
const basicApplyRules = require('./basic/basicApplyRules');
const graphviz = require('./graphViz');
const reduceGraph = require('./reduceGraph');
const findIdle = require('./findIdle');

function buildHBGraph (args) {
    var asyncObjects = args.asyncObjects,
        promiseAllSet = args.promiseAllSet,
        promiseRaceSet = args.promiseRaceSet,
        isbuildGraph = args.isbuildGraph,
        isBasicAlg = args.isBasicAlg,
        actions = args.actions,
        records = args.records;

    //if (!isBasicAlg)
        asyncObjects = findIdle(asyncObjects.getAll(), records.getAll());
    console.log('_index: %s', asyncObjects.getAll().map(e => e.id));
    console.log('length: %d', asyncObjects.getAll().length);
    var relations = new Relations(asyncObjects, promiseAllSet, promiseRaceSet);
    var rg = null;

    let hbFileName = null;
    let reducedHbFileName = null;
    if (isBasicAlg) {
        hbFileName = args.file.replace('.log', '.basicHB-full.json');
        reducedHbFileName = args.file.replace('.log', '.basicHB.json');
    } else {
        hbFileName = args.file.replace('.log', '.newhb-full.json');
        reducedHbFileName = args.file.replace('.log', '.newhb.json');
    }
    //let hbFileName = args.file.replace('.log', '.newhb-full.json');

    //let reducedHbFileName = args.file.replace('.log', '.newhb.json');

    let isReducedGraph = false;
    if (isbuildGraph) {
        if (isBasicAlg)
            basicApplyRules(asyncObjects, relations, actions);
        else
            newApplyRules._applyRules(asyncObjects, relations, actions);

        //reduced graph only with callback nodes
        let rg = null;
        if (isReducedGraph) rg = reduceGraph(asyncObjects, relations, actions);

        //merge events and actions

        //write hb results into files
        //let hbFileName = args.file.replace('.log', '.hb-full.json')
        console.log(hbFileName);
        //fs.writeFileSync(hbFileName, JSON.stringify({ relations }, null, 4), 'utf-8');
        fs.writeFileSync(hbFileName, JSON.stringify({
            objects: [...relations.asyncObjs.getAll(), ...actions],
            relations: relations.hb,
            chains: relations.chains,
            sync: relations.sync,
        }, null, 4), 'utf-8');
        //let reducedHbFileName = args.file.replace('.log', '.newhb.json');
        console.log(reducedHbFileName);
        if (isReducedGraph)
        fs.writeFileSync(reducedHbFileName, JSON.stringify({
            objects: rg.asyncObjects.getAll(),
            relations: rg.relations.hb,
            chains: relations.chains,
            sync: relations.sync,
        }, null, 4), 'utf-8');

        //visualize hb graph
        if (args.image) {
            let figureFileName = null;
            let reducedFigureFileName = null;
            if (isBasicAlg) {
                figureFileName = args.file.replace('.log', '.basicHB-full.png');
                reducedFigureFileName = args.file.replace('.log', '.basicHB-only.png');
            } else {
                figureFileName = args.file.replace('.log', '.newhb-graph-full.png');
                reducedFigureFileName = args.file.replace('.log', '.newhb-graph-only-cbs.png');
            }
            //let figName = args.file.replace('.log', '.newhb-graph-full.png');
            console.log(figureFileName);
            //graphviz.drawGraph(figName, {nodes:
            //[...asyncObjects.getAll(), ...actions], edges: relations.hb});
            graphviz.drawGraph(figureFileName, {nodes: relations.nodes, edges: relations.hb});
            
            //figName = args.file.replace('.log', '.newhb-graph-only-cbs.png');
            console.log(reducedFigureFileName);
            if (isReducedGraph) graphviz.drawGraph(reducedFigureFileName, { nodes: rg.relations.nodes, edges: rg.relations.hb });
        }

        //console.log(relations.hb);
    }

    return { hbFileName: hbFileName, relations: relations, /*rg: !rg || rg.relations*/};
}

module.exports = buildHBGraph;