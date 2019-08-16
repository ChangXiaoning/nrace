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
        op2Var[io.fileAccessOp] = varIO
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
            solver.add(z3.Or(op2Var[cbi.getEnd()] < op2Var[cbj.getStart(
            )], op2Var[cbi.getStart()] > op2Var[cbj.getEnd()]))

    # trigger-start
    for i in range(0, len(trace.events)):
        cbi = trace.events[i]
        cbiResolve = cbi.resolve
        if cbiResolve:
            solver.add(op2Var[cbiResolve] < op2Var[cbi.getStart()])

    # async ios
    for i in range(0, len(trace.ioActions)):
        io = trace.ioActions[i]
        solver.add(z3.And(op2Var[io.registerOp] < op2Var[io.fileAccessOp],
                          op2Var[io.fileAccessOp] < op2Var[io.resolveOp]))

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

def isConflictOnVariable(op1, op2):
    if op1.accessVar == op2.accessVar:
        if op1.accessType == 'W' or op2.accessType == 'R':
            return True
    return False

def isConflictOnFile(op1, op2):
    _fsPattern = {"C": ["D", "R", "O", "S"],
                  "D": ["C", "R", "W", "O", "X", "S"],
                  "R": ["C", "D", "W"],
                  "W": ["D", "R", "X"],
                  "O": ["C", "D", "X"],
                  "X": ["D", "O", "W"],
                  "S": ["C", "D"]
                  }
    if op1.accessFile == op2.accessFile and op1.accessType in _fsPattern[op2.accessType]:
        return True
    return False

def isConcurrent(op1, op2):
    solver.push()
    solver.add(op2Var[op1] < op2Var[op2])
    res = solver.check()
    solver.pop()
    if res == z3.sat:
        solver.push()
        solver.add(op2Var[op1] > op2Var[op2])
        res = solver.check()
        solver.pop()
        if res == z3.sat:
            return True
    return False

def isEventConcurrent(ev1, ev2):
    op1 = ev1.ops[1]
    op2 = ev2.ops[1]
    return isConcurrent(op1, op2)

def isConflict(op1, op2):
    if isinstance(op1, zzTraceParser.DataAccessOp) and isinstance(op2, zzTraceParser.DataAccessOp):
        if isConflictOnVariable(op1, op2):
            return True
    if isinstance(op1, zzTraceParser.FileAccessOp) and isinstance(op2, zzTraceParser.FileAccessOp):
        if isConflictOnFile(op1, op2):
            return True
    return False

def isEventConflict(ev1, ev2):
    for op1 in ev1.ops:
        for op2 in ev2.ops:
            if isConflict(op1, op2):
                return True
    return False

def isRace(op1, op2):
    if isConflict(op1, op2) and isConcurrent(op1, op2):
        print('A race detected!')
        return True
    return False

def isEventRace(ev1, ev2):
    if isEventConflict(ev1, ev2) and isEventConcurrent(ev1, ev2):
        return True
    return False

def isEventvsIORace(ev, io):
    for op in ev.ops:
        if isRace(op, io.fileAccessOp):
            return True
    return False

def isIOvsIORace(io1, io2):
    return isRace(io1.fileAccessOp, io2.fileAccessOp)

def detectRace(trace):

    buildMhp(trace)

    raceCount = 0
    for i in range(0, len(trace.events)-1):
        for j in range(1, len(trace.events)):
            if isEventRace(trace.events[i], trace.events[j]):
                raceCount += 1
    
    for i in range(0, len(trace.ioActions)-1):
        for j in range(1, len(trace.ioActions)):
            if isIOvsIORace(trace.ioActions[i], trace.ioActions[j]):
                raceCount += 1

    for i in range(0, len(trace.events)):
        for j in range(0, len(trace.ioActions)):
            if isEventvsIORace(trace.events[i], trace.ioActions[j]):
                raceCount += 1

    print('We find some races: ' + str(raceCount))
    pass