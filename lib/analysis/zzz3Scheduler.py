import z3
import sys
import os
import zzTraceParser
import time

'''
rootPath=os.path.dirname(os.path.realpath(__file__))
z3path=rootPath+'/z3py/bin/python/z3'
print z3path
sys.path.append(z3path)

import __builtin__
__builtin__.Z3_LIB_DIRS=[rootPath+'/z3py/bin']
'''

rootPath = 'D:/software/z3-4.8.5'
z3path = rootPath+'/bin/python/z3'
sys.path.append(z3path)

solver = z3.Solver()
vars = list()
op2Var = dict()

def buildMhp(trace):
    print('Building must-happen-before...')
    start = time.time()
    # Initialize z3 vars
    for i in range(0, len(trace.events)):
        event = trace.events[i]
        for j in range(0, len(event.ops)):
            op = event.ops[j]
            var = z3.Int('var-' + str(len(vars)))
            vars.append(var)
            op2Var[op] = var
            solver.add(var > 0)

    for i in range(0, len(trace.ioActions)):
        io = trace.ioActions[i]
        varIO = z3.Int('var-' + str(len(vars)))
        vars.append(varIO)
        op2Var[io.fileAccessOP] = varIO
        solver.add(varIO > 0)

        varResolve = z3.Int('var-' + str(len(vars)))
        vars.append(varResolve)
        op2Var[io.resolveOp] = varResolve
        solver.add(varResolve > 0)

    # solver.add(z3.Distinct(vars))   #Time-consuming for z3.

    # atomicity
    for i in range(0, len(trace.events)):
        event = trace.events[i]
        for j in range(0, len(event.ops)-1):
            op1 = event.ops[j]
            op2 = event.ops[j + 1]
            varOp1 = op2Var[op1]
            varOp2 = op2Var[op2]
            solver.add(varOp1 + 1 == varOp2)

    for i in range(0, len(trace.events)-1):
        for j in range(i + 1, len(trace.events)):
            cbi = trace.events[i]
            cbj = trace.events[j]
            solver.add(z3.Or(op2Var[cbi.getEnd()] < op2Var[cbj.getStart()], op2Var[cbi.getStart()] > op2Var[cbj.getEnd()]))

    # trigger-start
    for i in range(0, len(trace.events)):
        cbi = trace.events[i]
        cbiResolve = cbi.resolve
        if cbiResolve:
            solver.add(op2Var[cbiResolve] < op2Var[cbi.getStart()])

    # async ios
    for i in range(0, len(trace.ioActions)):
        io = trace.ioActions[i]
        solver.add(z3.And(op2Var[io.registerOp] < op2Var[io.fileAccessOP], op2Var[io.fileAccessOP] < op2Var[io.resolveOp]))   

    # fifo, different priority
    for i in range(1, len(trace.events)-1):
        for j in range(i + 1, len(trace.events)):
            cb1 = trace.events[i]
            cb2 = trace.events[j]
            cb1Start = cb1.getStart()
            cb2Start = cb2.getStart()
            cb1Resolve = cb1.resolve
            cb2Resolve = cb2.resolve

            if not cb1Resolve or not cb1Resolve:
                continue

            # fifo
            if cb1.priority == cb2.priority:
                solver.add(z3.Or(z3.And(op2Var[cb1Resolve] < op2Var[cb2Resolve], op2Var[cb1Start] < op2Var[cb2Start]), z3.And(
                    op2Var[cb1Resolve] > op2Var[cb2Resolve], op2Var[cb1Start] > op2Var[cb2Start])))

            # diff priority
            if cb1.priority != cb2.priority and (cb1.priority == 0 or cb2.priority == 0):
                # cb1 has high priority
                if cb1.priority == 0:
                    cbHighStart = cb1Start
                    cbHighResolve = cb1Resolve
                    cbLowStart = cb2Start
                # cb2 has high priority
                if cb2.priority == 0:
                    cbHighStart = cb2Start
                    cbHighResolve = cb2Resolve
                    cbLowStart = cb1Start
                    solver.add(z3.Implies(
                        op2Var[cbHighResolve] < op2Var[cbLowStart], op2Var[cbHighStart] < op2Var[cbLowStart]))

    end = time.time()
    interval = end - start
    print('Build constraints: ' + str(round(interval)) + 's')

    start = time.time()
    print(solver.check())
    end = time.time()
    interval = end - start
    print('Solve constraints: ' + str(round(interval)) + 's')

    pass
