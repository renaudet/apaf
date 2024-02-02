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

Other usefull environment variables for APAF:

* **APPLICATION** (optional) the NPA application to start - defaults to the NPA `test` application
* **LOG_DIR** (optional) the location for log files - defaults to './'
* **LOG_LEVEL** (optional) the initial logging level - defaults to 'info' - one of 'info', 'fine' and 'finest'
* **PORT** (optional) the HTTP server listening port - defaults to 9080
* **ENV_NAME** (optional) a name for the process that makes it easier to retrieve

A typical command-line may be:

```bash
$>node app.js --application apaf --logs ./logs --level info --port 9090 --name "APAF Test Server" 
```

where:

* **application** (optional) the NPA application to start - here 'apaf' - same as setting the `APPLICATION` environment variable
* **logs** (optional) the location for log files - defaults to './' - same as setting the `LOG_DIR` environment variable
* **level** (optional) the initial logging level - defaults to 'info' - one of 'info', 'fine' and 'finest' - same as setting the `LOG_LEVEL` environment variable
* **port** (optional) the HTTP server listening port - defaults to 9080 - same as setting the `PORT` environment variable
* **name** (optional) a name for the process that makes it easier to retrieve - same as setting the `ENV_NAME` environment variable

## Databases

Upon successfull startup, APAF will create the following CouchDB databases:

* apaf_users: contains APAF user definitions - for localy authenticated users the record only contains the md5 of the password
* apaf_groups: defines Groups of APAF Users - Groups are associated with Security Roles to grant access to APAF features
* apaf_roles: defines APAF and User-defined Security Roles
* apaf_datatypes: defines User-designed datatypes that may be used in custom databases, forms...
* apaf_fragments: defines the fragments of code used to assemble APAF applications
* apaf_applications: defines APAF User-defined applications - published ones will appear on the Applications menu

## Getting Started

Once the server is started, the APAF frontend may be accessed using the default URL `http://localhost:<apaf-port>`

You will have to login first using the `admin` user. The default password may be found in the `apaf.login`'s plugin.

![The APAF Login Screen](https://github.com/renaudet/apaf/blob/main/screenshots/loginPage.png?raw=true)

![The APAF Default Home Page](https://github.com/renaudet/apaf/blob/main/screenshots/homePage.png?raw=true)

### Administering your APAF Server

Once logged in as the `admin` user, the very first things to do are:

- [ ] change the admin user's password by using the Help / Manage Profile menu
- [ ] create some Users Groups using the Administration / Manage Groups menu
- [ ] associate built-in Security Roles to these Groups
- [ ] create some Users and associate them with those newly-created Groups

> [!CAUTION]
> Notice that the `admin` user is a full priviledges user the same way as a `root` user on an Unix Operating System. Hence it is a best practice to create a regular User for working session with APAF.

## Built-in Security Roles

The following built-in Security Roles are used by APAF to protect important features at server-level. A User must be associated to a required Security Role in order to be granted access to a protected API.

* administrator: required role for all administrative tasks such as creating/updating/deleting a User, a Group or a custom Security Role
* developer: required role for all development tasks such as creating/updating/deleting Code Fragments, APAF Applications or custom Datatypes

![The APAF Security Roles Management Screen](https://github.com/renaudet/apaf/blob/main/screenshots/rolesPage.png?raw=true)

![The APAF Groups Management Screen](https://github.com/renaudet/apaf/blob/main/screenshots/groupsPage.png?raw=true)

![The APAF Users Management Screen](https://github.com/renaudet/apaf/blob/main/screenshots/usersPage.png?raw=true)
