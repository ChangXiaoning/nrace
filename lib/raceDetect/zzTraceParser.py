import json
import os
import sys
import pprint
import time
import Logging
import json
import re

import TraceParser

class Trace:
    def __init__(self):
        self.events = list()
        self.ioActions = list()
        pass

class Event:
    def __init__(self):
        self.id = -1
        self.priority = -1
        self.resolve = None
        self.ops = list()
        pass

    def getStart(self):
        return self.ops[0]

    def getEnd(self):
        return self.ops[len(self.ops)-1]


class IOAction:
    def __init__(self):
        self.registerOp = None
        self.fileAccessOp = None
        self.resolveOp = None
        pass


class RegisterOp:
    def __init__(self):
        self.lineno = None
        self.resourceType = None
        pass


class ResolveOp:
    def __init__(self):
        self.lineno = None
        self.resourceType = None
        pass


class DataAccessOp:
    def __init__(self):
        self.lineno = None
        self.entryType = None
        self.accessType = None
        self.accessVar = None
        pass

class FileAccessOp:
    def __init__(self):
        self.lineno = None
        self.entryType = None
        self.accessType = None
        self.accessFile = None
        self.isAsync = None
        pass


def processTraceFile(traceFile):
    result = TraceParser.processTraceFile(traceFile)

    testsuit = result['testsuit']
    cbs = result['cbs']
    records = result['records']

    lineNo2Ops = dict()

    traces = list()
    for testcase in testsuit.values():
        trace = Trace()
        traces.append(trace)

        cbNum = len(testcase)

        for i in range(0, cbNum):
            cb = cbs[testcase[i]]

            if len(cb.records) == 0:
                # do not know why
                continue

            event = Event()
            event.id = cb.asyncId
            event.priority = TraceParser.getPriority(cb.resourceType)
            if hasattr(cb, 'resolve'):
                event.resolve = lineNo2Ops[cb.resolve]
            trace.events.append(event)

            rcdList = cb.records
            for j in range(0, len(rcdList) - 1):
                record = records[rcdList[j]]
                if isinstance(record, TraceParser.DataAccessRecord):
                    daOp = DataAccessOp()
                    event.ops.append(daOp)

                    daOp.lineno = record.lineno
                    daOp.entryType = record.entryType
                    daOp.accessType = record.accessType
                    daOp.accessVar = record.getId()

                    lineNo2Ops[record.lineno] = daOp

                elif isinstance(record, TraceParser.FileAccessRecord):
                    faOp = FileAccessOp()
                    event.ops.append(faOp)

                    faOp.lineno = record.lineno
                    faOp.entryType = record.entryType
                    faOp.accessType = record.accessType
                    faOp.accessFile = record.resource
                    faOp.isAsync = record.isAsync

                    lineNo2Ops[record.lineno] = faOp

                    # Assume: the registration and resolve operation has been parsed.
                    if faOp.isAsync:
                        try:
                            resOp = lineNo2Ops[record.resolve]
                            regOp = lineNo2Ops[record.resolve[:-1]]

                            ioAction = IOAction()
                            ioAction.registerOp = regOp
                            ioAction.fileAccessOp = faOp
                            ioAction.resolveOp = resOp
                            event.ops.remove(faOp)
                            event.ops.remove(resOp)
                            trace.ioActions.append(ioAction)
                        except (KeyError, ValueError):
                            # Do not know why, the resolve does not exit.
                            print('Unrecongnized resolve: ' + record.resolve)

                elif isinstance(record, TraceParser.Reg_or_Resolve_Op):
                    rLineno = record.lineno
                    if re.search('rr', rLineno):  # resolve operation
                        resolveOp = ResolveOp()
                        event.ops.append(resolveOp)

                        resolveOp.lineno = record.lineno
                        resolveOp.resourceType = record.resourceType

                        lineNo2Ops[record.lineno] = resolveOp

                    else:  # registration operation
                        registerOp = RegisterOp()
                        event.ops.append(registerOp)

                        registerOp.lineno = record.lineno
                        registerOp.resourceType = record.resourceType

                        lineNo2Ops[record.lineno] = registerOp

    return traces
