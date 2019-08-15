import zzTraceParser
import zzz3Scheduler

import sys
import os

lineno = -1
sourceMap = dict()
currentSourceFile = None
cbCtx = zzTraceParser.CbStack()
print_obj = zzTraceParser.print_obj

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
	parsedResult = zzTraceParser.processTraceFile(traceFile)

	#step 3: detect
	print '*******BEGIN DEBUG*******'
	#z3Detector.start_detect(parsedResult, isRace, isChain)
	zzz3Scheduler.startDetect(parsedResult, isRace, isChain)
	pass

if __name__ == '__main__':
	main()
	pass

