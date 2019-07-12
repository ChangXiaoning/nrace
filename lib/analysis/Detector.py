import TraceParser
import z3Scheduler
import z3Detector
import z3Scheduler

import sys
import os

lineno = -1
sourceMap = dict()
currentSourceFile = None
cbCtx = TraceParser.CbStack()

def main():
	traceFile = sys.argv[1]
	if sys.argv[2] == 't':
		isRace = True
	else:
		isRace = False
	if sys.argv[3] == 't':
		isChain = True
	else:
		isChain = False
	#step 1: parse record into object
	print '*******BEGIN PARSE TRACE FILE*******'
	parsedResult = TraceParser.processTraceFile(traceFile)
	print('after parse:\n')
	print('size of vars: %s' %(len(parsedResult)))
	#step 3: detect
	print '*******BEGIN DEBUG*******'
	#z3Detector.start_detect(parsedResult, isRace, isChain)
	z3Scheduler.startDebug(parsedResult, isRace, isChain)
	pass

if __name__ == '__main__':
	main()
	pass

