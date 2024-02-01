# APAF for NPA

APAF stands for All Purpose Application Framework. This is a framework for creating 3-tiers applications an easy way using a built-in application builder "from inside the application itself"

As the project name implies, it is built on top of NPA, the [Node Plugin Architecture](https://github.com/renaudet/Node-Plugin-Architecture) project

## Dependencies

APAF is based on [Node-Plugin-Architecture](https://github.com/renaudet/Node-Plugin-Architecture) and the [npa-ui-tools](https://github.com/renaudet/npa-ui-tools) framework

Given that npa-ui-tools is installed by convention in <install-root>/tools and that a suitable instalation directory for APAF could be  <install-root>/apaf, we could have the appConfig.json file looking as:

```json
{ 
	"sites": [
		{
			"id": "default",
			"location": "./plugins"
		},
		{
			"id": "tools",
			"location": "./tools/plugins"
		},
		{
			"id": "apaf",
			"location": "./apaf/plugins"
		}
	]
}
```

## Starting the server

APAF is designed to be compatible with container-based environments. Use environment variables and command-line parameters to configure the runtime.

A typical environment should define the following environment variables:

* **APAF_COUCH_DB_HOST** (optional) default to 127.0.0.1
* **APAF_COUCH_DB_PORT** (optional) default to 5984
* **APAF_COUCH_DB_USER** (required if CouchDB is secured)
* **APAF_COUCH_DB_USER_PASSWD** (required if CouchDB is secured)
* **NODE_PATH** (required) should point to the node_modules folder of the Node-Plugin-Architecture base installation

A typical command-line may be:

```bash
$>node app.js --application apaf --logs ./logs --level info --port 9090 --name "APAF Test Server" 
```

where:

* **application** (required) the NPA application to start - here 'apaf'
* **logs** (optional) the location for log files - defaults to './'
* **level** (optional) the initial logging level - defaults to 'info' - one of 'info', 'fine' and 'finest'
* **port** (optional) the HTTP server listening port - defaults to 9080
* **name** (optional) a name for the process that makes it easier to retrieve

## Databases

Upon successfull startup, APAF will create the following CouchDB databases:

* apaf_users: contains APAF user definitions - for localy authenticated users the record only contains the md5 of the password
* apaf_groups: defines Groups of APAF Users - Groups are associated with Security Roles to grant access to APAF features
* apaf_roles: defines APAF and User-defined Security Roles
* apaf_datatypes: defines User-designed datatypes that may be used in custom databases, forms...
* apaf_fragments: defines the fragments of code used to assemble APAF applications
* apaf_applications: defines APAF User-defined applications - published ones will appear on the Applications menu
