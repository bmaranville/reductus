#############################################################
# rename or copy this file to config.py if you make changes #
#############################################################

# change this to your fully-qualified domain name to run a 
# remote server.  The default value of localhost will
# only allow connections from the same computer.
#
# for remote (cloud) deployments, it is advised to remove 
# the "local" data_sources item below, and to serve static
# files using a standard webserver
#
# if use_redis is False, server will use in-memory cache.

# TODO: Convert this to JSON file in web-accesible ('static')
# directory.  

jsonrpc_servername = "0.0.0.0"
jsonrpc_port = 8001
http_port = 8000
redis_params = {"host": "redis"}
serve_staticfiles = False
use_redis = True
data_sources = [
    {
        "name": "ncnr",
        "url": "https://www.ncnr.nist.gov/pub/",
        "start_path": "ncnrdata",
    },
    {
        "name": "local",
        "url": "file:///",
    }
]
file_helper_url = {
    "ncnr": "https://www.ncnr.nist.gov/ipeek/listftpfiles.php"
}
