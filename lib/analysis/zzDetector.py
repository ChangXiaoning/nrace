import zzTraceParser
import zzz3Scheduler

import sys
import os

def main():
	argv1 = 'xxx' #sys.argv[1]
	argv2 = 'f'   #sys.argv[2]
	argv3 = 'f'   #sys.argv[3]

	traceFile = argv1
	if argv2 == 't':
		isRace = True
	else:
		isRace = False
	if argv3 == 't':
		isChain = True
	else:
		isChain = False

	#step 1: parse record into object
	print '*******BEGIN PARSE TRACE FILE*******'
	traces = zzTraceParser.processTraceFile(traceFile)

	print('Test cases: ' + str(len(traces)))
	for i in range(0, len(traces)):
		trace = traces[i]
		print('Trace ' + str(i))
		print ('Event: ' + str(len(trace.events)))
		
		zzz3Scheduler.detectRace(trace)

	print '*******BEGIN DEBUG*******'
	#zzz3Scheduler.startDebug(parsedResult, isRace, isChain)
	pass

if __name__ == '__main__':
	main()
	pass

