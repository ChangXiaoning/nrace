import os
import json


def read_object_from_file(file_name):
    """
    read an object from json file
    :param file_name: json file name
    :return: None if file doesn't exist or can not convert to an object by json, else return the object
    """
    if os.path.exists(file_name) is False:
        print ("Error read path: [%s]" % file_name)
        return None
    with open(file_name, 'r') as f:
        try:
            obj = json.load(f)
        except Exception:
            print ("Error json: [%s]" % f.read()[0:10])
            return None
    return obj


def write_object_to_file(file_name, mode, target_object):
    """
    write the object to file with json(if the file exists, this function will overwrite it)
    :param file_name: the name of new file
    :param target_object: the target object for writing
    :return: True if success else False
    """
    dirname = os.path.dirname(file_name)
    find_and_create_dirs(dirname)
    try:
        with open(file_name, mode) as f:
            json.dump(target_object, f, skipkeys=False, ensure_ascii=False, check_circular=True, allow_nan=True, cls=None, indent=True, separators=None, encoding="utf-8", default=None, sort_keys=False)
    except Exception, e:
        message = "Write [%s...] to file [%s] error: json.dump error" % (str(target_object)[0:10], file_name)
        print ("%s\n\t%s" % (message, e.message))
        print "e.message: ", e.message
        return False
    else:
        # logging.info(get_time() + ": Write " + self.docker_save_path + doc_file_name + ".json")
        print ("Write %s" % file_name)
        return True


def find_and_create_dirs(dir_name):
    """
    find dir, create it if it doesn't exist
    :param dir_name: the name of dir
    :return: the name of dir
    """
    if os.path.exists(dir_name) is False:
        os.makedirs(dir_name)
    return dir_name

