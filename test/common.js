var path = require('path');

function Common () {
    //TODO: shell.env['NODERACER']
    var TOOL_HOME = '/Users/xiaoningchang/Code/noderacer',
        ANALYSIS_SRC_DIR = TOOL_HOME + path.sep + 'lib/typerrorDetect';

    var COLOR = Object.freeze({
        GREY: 'grey',
        RED: 'red',
        WHITE: 'white',
        GREEN: '#2ECC71', //'green',
        PURPLE: 'purple',
        ORANGE: '#E67E22', //'orange',
        TURQUOISE: '#1ABC9C', //'turquoise'
        DARKGREY: "#2E4053",
        LIGHTGREY: "#D6DBDF",  //"#CCD1D1", //"#F4F6F6", //"#F8F9F9"
        MEDGREY: "#707B7C",  //'#85929E',
        LIGHTRED: '#FADBD8'
    });

    var STYLE = Object.freeze({
        FILLED: 'filled'
    });

    var SHAPE = Object.freeze({
        CIRCLE: 'circle',
        BOX: 'box',
        EGG: 'egg',
        ELLIPSE: 'ellipse',
        INVTRIANGLE: 'invtriangle'
    });

    var GRAPHVIZ_CONFIG = {
        EVENT: {
            
        },
        EDGE: {

        },
        VITUAL_EVENT: {

        }
    };

    return {
        TOOL_HOME: TOOL_HOME,
        COLOR: COLOR,
        STYLE: STYLE,
        SHAPE: SHAPE,
    };
};

module.exports = Common();