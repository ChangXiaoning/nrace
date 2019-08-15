from __future__ import print_function
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

    def length(self):
        return len(self.events)

    def get(self, id):
        assert id >= 1 and id <= self.length(), 'id is out of range.'
        return self.events[id - 1]


class Event:
    def __init__(self):
		self.id = -1
        self.priority = -1
		self.resolve = None
        self.ops = list()
        pass

    def length(self):
        return len(self.ops)

    def get(self, id):
        assert id >= 1 and id <= self.length(), 'id is out of range.'
        return self.ops[id - 1]

    def getStart(self):
        return self.get(1)

    def getEnd(self):
        return self.get(self.length())

class IOAction:
    def __init__(self):
		self.registerOp = None
        self.fileAccessOP = None
        self.resolveOp = None
        pass

class RegisterOp:
    def __init__(self, lineno, prior, follower, resourceType):
        self.lineno = lineno
        self.prior = prior
        self.follower = follower
        self.resourceType = resourceType
        pass

class ResolveOp:
    def __init__(self, lineno, prior, follower, resourceType):
        self.lineno = lineno
        self.prior = prior
        self.follower = follower
        self.resourceType = resourceType
        pass

class DataAccessOp:
    def __init__(self, lineno, entryType, accessType, accessVar):
        self.lineno = lineno
        self.entryType = entryType
        self.accessType = accessType
        self.accessVar = accessVar
        pass

class FileAccessOp (object):
    def __init__(self, lineno, entryType, accessType, resource, isAsync):
        self.lineno = lineno
        self.entryType = entryType
        self.accessType = accessType
        self.accessFile = resource
        self.isAsync = isAsync
		self.register = None
		self.resolve = None
        pass

def processTraceFile(traceFile):
	result = TraceParser.processTraceFile(traceFile)

	testsuit = result['testsuit']
	cbs = parsedResult['cbs']
	records = result['records']
	variables = result['vars']
	files = result['files']

	lineNo2Ops = dict()

    for testcase in testsuit.values():
		trace = Trace()

        cbNum = len(testcase)
        for i in range(0, cbNum - 1):
            cb = result.cbs[testcase[i]]

			event = Event()
			event.id = cb.asyncId
			event.priority = getPriority(cb.resourceType)
			event.resolve = lineNo2Ops[cb.resolve]
			trace.events.append(event)

			if len(cb.records) == 0:
				event.ops = list()

			rcdList = cb.records
			for j in range(0, len(rcdList) - 1):
				record = records[j]
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

					#Assume: the registration and resolve operation has been parsed.
					if (faOp.isAsync):
						resOp = lineNo2Ops[record.resolve]
						regOp = lineNo2Ops[record.resolve[:-1]]
						event.ops.remove(resOp)
						event.ops.remove(faOp)

						ioAction = IOAction()
						ioAction.registerOp = regOp
						ioAction.fileAccessOP = faOp
						ioAction.resolveOp = resOp
						trace.ioActions.append(ioAction)

				elif isinstance(record, TraceParser.Reg_or_Resolve_Op):
					rLineno = record.lineno
					if re.search('rr', rLineno): # resolve operation
						resolveOp = ResolveOp()
						event.ops.append(resolveOp)

						resolveOp.lineno = record.lineno
						resolveOp.prior = record.prior
						resolveOp.follower = record.follower
						resolveOp.resourceType = record.resourceType

						lineNo2Ops[record.lineno] = resolveOp

					else: # registration operation
						registerOp = RegisterOp()
						event.ops.append(registerOp)

						registerOp.lineno = record.lineno
						registerOp.prior = record.prior
						registerOp.follower = record.follower
						registerOp.resourceType = record.resourceType

						lineNo2Ops[record.lineno] = registerOp

    exit
    return result
