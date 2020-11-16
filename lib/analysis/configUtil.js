/*
 * Copyright (c) 2014 Samsung Electronics Co., Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
(function (sandbox) {
    var myEscope;
    if (typeof escope === 'undefined') {
        myEscope = require('escope');
    }
    else {
        myEscope = escope;
    }
    /**
     * sentinel object to represent any name
     */
    var ANY = "ANY";
    /**
     * given an AST node for a function, compute the free variables referenced from
     * the function and from nested functions.  Returns either an array of free variable
     * names (strings), or ANY, indicating that the analysis cannot compute a sound set
     * of referenced names due to some dynamic construct like eval
     */
    function freeVars(function_ast) {
        // 1. collect declarations for scope
        //    - parameters and function name (if named)
        //    - var declarations (including inside loop heads)
        //    - function statements
        // 2. collect free vars for scope, based on declarations
        // 3. recurse into nested functions, with current scope becoming "parent"
        // gotchas:
        //   - 'this' is always in scope; also 'arguments'.  watch out for other reserved words
        var result = {};
        if (function_ast.type !== 'Program') {
            function_ast = {
                'type': 'Program',
                'body': [function_ast]
            };
        }
        var scopes = myEscope.analyze(function_ast).scopes;
        var referenceHandler = function (r) {
            if (!r.resolved) {
                result[r.identifier.name] = true;
            }
        };
        for (var i = 0; i < scopes.length; i++) {
            var s = scopes[i];
            if (s.dynamic && s.type !== 'global') {
                // some use of dynamic construct, be conservative
                return ANY;
            }
            s.references.forEach(referenceHandler);
        }
        return result;
    }
    /**
     * instrumentation handler that does customized instrumentation for the trace generation
     */
    var instHandler = {
        instrRead: function (name, ast) {
            return true;
        },
        instrWrite: function (name, ast) {
            return true;
        },
        instrGetfield: function (offset, ast) {
            return true;
        },
        instrPutfield: function (offset, ast) {
            return true;
        },
        instrBinary: function (operator, ast) {
            return operator === 'delete';
        },
        instrPropBinaryAssignment: function (operator, offset, ast) {
            return true;
        },
        instrUnary: function (operator, ast) {
            return false;
        },
        instrLiteral: function (literal, ast) {
            return literal !== null && literal !== undefined && (typeof literal === 'object' || typeof literal === 'function');
        },
        instrConditional: function (type, ast) {
            return true;
        },
    };

    function skipInstrument (filename){
        if(filename.match('_avd.js|test|Gruntfile|.html')){
            return true;
        }
        return false;
    }
    
    function instrumentCodePre (thisIid, code, isDirect, instCodeFileName, origCodeFileName){
        if(code.indexOf('JALANGI DO NOT INSTRUMENT')>=0){
            return {code: code, skip: true};
        }
        var fsagent = require('path').join(__dirname, './fsAgent.js');
        code = code.replace('require("fs")','require("'+fsagent+'")').replace("require('fs')",'require("'+fsagent+'")');
        if(instCodeFileName.match('node_modules')){
            return {code: code, skip: true};
        }
        return {code: code, skip: false};
    }
    function instrumentCode (thisIid, instCode, newAst, isDirect){
        var _path = require('path').join(__dirname, './loadRuntime.js');
        instCode = 'require("'+_path+'")\n' + instCode;
        return {result: instCode }
    }
    function getTraceFile (){
        return 'ascii-trace.log';
    }


    var exportObj = {};
    sandbox.configUtil = exportObj;
    exportObj.ANY = ANY;
    exportObj.freeVars = freeVars;
    exportObj.instHandler = instHandler;
    exportObj.skipInstrument = skipInstrument;
    exportObj.instrumentCodePre = instrumentCodePre;
    exportObj.instrumentCode = instrumentCode;
    exportObj.getTraceFile = getTraceFile;
})((typeof J$ === 'undefined') ? J$ = {} : J$);
//# sourceMappingURL=configUtil.js.map
