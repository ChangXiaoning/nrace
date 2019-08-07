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
print_obj = TraceParser.print_obj

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
	'''		
	print(parsedResult)
	for rcd in parsedResult['files'].values():
		if isinstance(rcd, TraceParser.FileAccessRecord):
			print(print_obj(rcd, ['lineno', 'entryType', 'accessType', 'resource', 'ref', 'name', 'eid', 'location', 'isAsync']))
	'''
	for fileName in parsedResult['files']:
		print("%s: [%s]\n"  %(fileName, len(parsedResult['files'][fileName])))
	#print(parsedResult['files'])
	
	#print('after parse:\n')
	#res = map(lambda x: int(x), parsedResult['cbs'].keys())
	#res.sort()
	#print(res)
	#print('size of vars: %s' %(len(parsedResult)))
	#step 3: detect
	print '*******BEGIN DEBUG*******'
	#z3Detector.start_detect(parsedResult, isRace, isChain)
	z3Scheduler.startDebug(parsedResult, isRace, isChain)
	pass

if __name__ == '__main__':
	main()
	pass

