import TraceParser
import z3Scheduler
import z3Detector

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
	
	#step 3: detect
	print '*******BEGIN DEBUG*******'
	z3Detector.start_detect(parsedResult, isRace, isChain)
	pass

if __name__ == '__main__':
	main()
	pass

