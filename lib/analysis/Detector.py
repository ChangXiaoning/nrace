import TraceParser
import z3Scheduler
import json_utils
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
	#step 2: save parsed result into file
	print '*******SAVE RESULTS*******'
	'''
	rootPath = os.path.dirname(os.path.realpath(traceFile))
	filePath = rootPath + 'parsed.json'
	#json_utils.write_object_to_file(filePath, parsedResult)
	for key in parsedResult:
		print("key: %s\n" %(key))
		with open(filePath, 'a+') as f:
			f.write("\n*******%s:*******\n" %(key))
		if isinstance(parsedResult[key], dict):
			for value in parsedResult[key].values():
				value.toJSON(filePath)
		elif isinstance(parsedResult[key], list):
			json_utils.write_object_to_file(filePath, 'a+', parsedResult[key])
	'''
	#step 3: detect
	print '*******BEGIN DEBUG*******'
	z3Scheduler.startDebug(parsedResult, isRace, isChain)
	pass

if __name__ == '__main__':
	main()
	pass

