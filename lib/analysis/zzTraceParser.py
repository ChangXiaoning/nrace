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
		self.libuvIOEvents = list()
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

class LibuvIOEvent:
    def __init__(self):
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

class DataAccessOP:
    def __init__(self, lineno, entryType, accessType, accessVar):
        self.lineno = lineno
        self.entryType = entryType
        self.accessType = accessType
        self.accessVar = accessVar
        pass

class FileAccessOp (object):
    def __init__(self, lineno, entryType, accessType, resource, ref, name, isAsync):
        self.lineno = lineno
        self.entryType = entryType
        self.accessType = accessType
        self.accessFile = resource
        self.isAsync = isAsync
        pass

def processTraceFile(traceFile):
	result = TraceParser.processTraceFile(traceFile)

	testsuit = result['testsuit']
	cbs = parsedResult['cbs']
	records = result['records']
	variables = result['vars']
	files = result['files']

    for testcase in testsuit.values():
		trace = Trace()

        cbNum = len(testcase)
        for i in range(0, cbNum - 1):
            cb = result.cbs[testcase[i]]

			event = Event()
			event.id = cb.asyncId
			event.priority = getPriority(cb.resourceType)
			trace.events.append(event)

			if len(cb.records) == 0:
				event.ops = list()

			rcdList = cb.records
			for j in range(0, len(rcdList) - 1):
				record = cb.records[j]
				if isinstance(record, TraceParser.DataAccessRecord):
					daOp = DataAccessOP()
					event.ops.append(daOp)

					daOp.lineno = record.lineno
					daOp.entryType = record.entryType
					daOp.accessType = record.accessType
					daOp.accessVar = record.getId()

				elif isinstance(record, TraceParser.FileAccessRecord):
					faOp = FileAccessOp()
					event.ops.append(faOp)

					faOp.lineno = record.lineno
					faOp.entryType = record.entryType
					faOp.accessType = record.accessType
					faOp.accessFile = record.resource
					faOp.isAsync = record.isAsync

				elif isinstance(record, TraceParser.Reg_or_Resolve_Op):
					rLineno = record.lineno
					if re.search('rr', rLineno): # resolve operation
						resolveOp = ResolveOp()
						event.ops.append(resolveOp)

						resolveOp.lineno = record.lineno
						resolveOp.prior = record.prior
						resolveOp.follower = record.follower
						resolveOp.resourceType = record.resourceType

					else: # registration operation
						registerOp = RegisterOp()
						event.ops.append(registerOp)

						registerOp.lineno = record.lineno
						registerOp.prior = record.prior
						registerOp.follower = record.follower
						registerOp.resourceType = record.resourceType

    exit
    return result
