var LogEntryType = {};
LogEntryType[LogEntryType["DECLARE"] = 0] = "DECLARE";
LogEntryType[LogEntryType["WRITE"] = 1] = "WRITE";
LogEntryType[LogEntryType["PUTFIELD"] = 2] = "PUTFIELD";
//
LogEntryType[LogEntryType["CREATE_OBJ"] = 3] = "CREATE_OBJ";
LogEntryType[LogEntryType["CREATE_FUN"] = 4] = "CREATE_FUN";
LogEntryType[LogEntryType["READ"] = 10] = "READ"; 
LogEntryType[LogEntryType["GETFIELD"] = 11] = "GETFIELD";
LogEntryType[LogEntryType["CALL"] = 12] = "CALL";
LogEntryType[LogEntryType["FUNCTION_ENTER"] = 13] = "FUNCTION_ENTER";
LogEntryType[LogEntryType["FUNCTION_EXIT"] = 14] = "FUNCTION_EXIT";
//
LogEntryType[LogEntryType["RETURN"] = 15] = "RETURN";
//
LogEntryType[LogEntryType["DELETE"] = 16] = "DELETE";
LogEntryType[LogEntryType["LITERAL"] = 17] = "LITERAL";
LogEntryType[LogEntryType["CONDITIONAL"] = 18] = "CONDITIONAL";
LogEntryType[LogEntryType["FUNCTION_ARG"] = 19] = "FUNCTION_ARG";
//
LogEntryType[LogEntryType["ASYNC_INIT"] = 20] = "ASYNC_INIT";
LogEntryType[LogEntryType["ASYNC_BEFORE"] = 21] = "ASYNC_BEFORE";
LogEntryType[LogEntryType["ASYNC_AFTER"] = 22] = "ASYNC_AFTER";
LogEntryType[LogEntryType["ASYNC_PROMISERESOLVE"] = 23] = "ASYNC_PROMISERESOLVE";
LogEntryType[LogEntryType["ASYNC_INIT_TIMER"] = 24] = "ASYNC_INIT_TIMER";
LogEntryType[LogEntryType["PROMISE_ALL_BEGIN"] = 25] = "PROMISE_ALL_BEGIN";
LogEntryType[LogEntryType["PROMISE_ALL_END"] = 26] = "PROMISE_ALL_END";
LogEntryType[LogEntryType["PROMISE_RACE_BEGIN"] = 27] = "PROMISE_RACE_BEGIN";
LogEntryType[LogEntryType["PROMISE_RACE_END"] = 28] = "PROMISE_RACE_END";
LogEntryType[LogEntryType["DEBUG"] = 30] = "DEBUG";
//
LogEntryType[LogEntryType["UPDATE_IID"] = 31] = "UPDATE_IID";
LogEntryType[LogEntryType["SCRIPT_ENTER"] = 32] = "SCRIPT_ENTER";
LogEntryType[LogEntryType["SCRIPT_EXIT"] = 33] = "SCRIPT_EXIT";
//
LogEntryType[LogEntryType["FREE_VARS"] = 34] = "FREE_VARS";
LogEntryType[LogEntryType["SOURCE_MAPPING"] = 35] = "SOURCE_MAPPING";
//
LogEntryType[LogEntryType["UPDATE_CURRENT_SCRIPT"] = 36] = "UPDATE_CURRENT_SCRIPT";
LogEntryType[LogEntryType["FS_OPEN"] = 40] = "FS_OPEN";
LogEntryType[LogEntryType["FS_READ"] = 41] = "FS_READ";
LogEntryType[LogEntryType["FS_WRITE"] = 42] = "FS_WRITE";
LogEntryType[LogEntryType["FS_CLOSE"] = 43] = "FS_CLOSE";
LogEntryType[LogEntryType["FS_DELETE"] = 44] = "FS_DELETE";
LogEntryType[LogEntryType["FS_CREATE"] = 45] = "FS_CREATE";
LogEntryType[LogEntryType["FS_STAT"] = 46] = "FS_STAT";
//
LogEntryType[LogEntryType["INVOKE_FUN"] = 47] = "INVOKE_FUN";
//To associate readstream and writestream with its file
LogEntryType[LogEntryType["FS_CREATEREADSTREAM"] = 48] = "FS_CREATEREADSTREAM";
LogEntryType[LogEntryType["FS_CREATEWRITESTREAM"] = 49] = "FS_CREATEWRITESTREAM";
LogEntryType[LogEntryType["FS_READSTREAM"] = 50] = "FS_READSTREAM";
LogEntryType[LogEntryType["FS_WRITESTREAM"] = 51] = "FS_WRITESTREAM";
//
LogEntryType[LogEntryType["BINARY"] = 52] = "BINARY";
module.exports = LogEntryType;
