import os
import sys
import time

rootPath='D:/software/z3-4.8.5'
z3path=rootPath+'/bin/python/z3'
sys.path.append(z3path)
import z3

eventNum = 100
opNum = 100

class Trace:
    def __init__(self):
        self.callbacks = list()
        for i in range(1, eventNum + 1):
            self.callbacks.append(Callback(i, i % 4))
        pass

    def length(self):
        return len(self.callbacks)

    def get(self, id):
        assert id >= 1 and id <= self.length(), 'id is out of range.'
        return self.callbacks[id - 1]

class Callback:
    def __init__ (self, id, priority):
        self.id = id
        self.priority = priority
        self.records = list()
        for i in range(1, opNum + 1):
            self.records.append(Op(i))               
        pass

    def length(self):
        return len(self.records)

    def get(self, id):
        assert id >= 1 and id <= self.length(), 'id is out of range.'
        return self.records[id - 1]

    def getStart(self):
        return self.get(1)

    def getEnd(self):
        return self.get(self.length())

class Op:
    def __init__(self, id):
        self.id = id
        pass

trace = Trace()

solver = z3.Solver()
vars = list()
op2Var = dict()

start = time.time()

# Initialize z3 vars
for i in range(1, trace.length() + 1):
    cb = trace.get(i)
    for j in range(1, cb.length() + 1):
        op = cb.get(j)
        var = z3.Int('event:' + str(cb.id) + '#op:' + str(op.id))
        vars.append(var)
        op2Var[op] = var
        solver.add(var > 0)     #Use less constraints.

#solver.add(z3.Distinct(vars))   #Time-consuming for z3.

#atomicity
for i in range(1, trace.length() + 1):
    cb = trace.get(i)
    for j in range(1, cb.length()):
        op1 = cb.get(j)
        op2 = cb.get(j + 1)
        varOp1 = op2Var[op1]
        varOp2 = op2Var[op2]
        solver.add(varOp1 + 1 == varOp2)

for i in range(1, trace.length()):
    for j in range(i + 1, trace.length() + 1):
        cbi = trace.get(i)
        cbj = trace.get(j)
        solver.add(z3.Or(op2Var[cbi.getEnd()] < op2Var[cbj.getStart()], op2Var[cbi.getStart()] < op2Var[cbj.getEnd()]))

triggerLoc = 3
#trigger-start
for i in range(1, trace.length()):
    cb1 = trace.get(i)
    cb2 = trace.get(i + 1)
    cb2Trigger = cb1.get(triggerLoc)
    cb2Start = cb2.getStart()
    solver.add(op2Var[cb2Trigger] < op2Var[cb2Start])

#fifo, different priority
for i in range(2, trace.length()):
    for j in range(i + 1, trace.length() + 1):
        cb1 = trace.get(i)
        cb2 = trace.get(j)
        cb1Start = cb1.getStart()
        cb2Start = cb2.getStart()
        cb1Trigger = trace.get(i - 1).get(triggerLoc)
        cb2Trigger = trace.get(j - 1).get(triggerLoc)

        #fifo
        if cb1.priority == cb2.priority:
            solver.add(z3.Or(z3.And(op2Var[cb1Trigger] < op2Var[cb2Trigger], op2Var[cb1Start] < op2Var[cb2Start]), z3.And(op2Var[cb1Trigger] > op2Var[cb2Trigger], op2Var[cb1Start] > op2Var[cb2Start])))
        
            #diff priority
        if cb1.priority != cb2.priority and (cb1.priority == 0 or cb2.priority == 0):
            #cb1 has high priority
            if cb1.priority == 0:
                cbHighStart = cb1Start
                cbHighTrigger = cb1Trigger
                cbLowStart = cb2Start
            #cb2 has high priority
            if cb2.priority == 0:
                cbHighStart = cb2Start
                cbHighTrigger = cb2Trigger
                cbLowStart = cb1Start
            solver.add(z3.Implies(op2Var[cbHighTrigger] < op2Var[cbLowStart], op2Var[cbHighStart] < op2Var[cbLowStart]))

end = time.time()
interval = end - start
print('Build constraints: ' + str(round(interval)) + 's')

start = time.time()

if solver.check() == z3.sat:
    model = solver.model()
    for i in range(1, trace.length() + 1):
        cbStart = trace.get(i).getStart()
        res = solver.model().eval(op2Var[cbStart])
        if i < eventNum:
            print(res),
        else:
            print(res)

end = time.time()
interval = end - start
print('Solve constraints: ' + str(round(interval)) + 's')
