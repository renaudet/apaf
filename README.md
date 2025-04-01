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

### Environment variables

APAF is designed to be compatible with container-based environments. Use environment variables and command-line parameters to configure the runtime.

A typical environment should define the following environment variables:

* **APAF_COUCH_DB_HOST** (optional) default to 127.0.0.1
* **APAF_COUCH_DB_PORT** (optional) default to 5984
* **APAF_COUCH_DB_USER** (required if CouchDB is secured)
* **APAF_COUCH_DB_USER_PASSWD** (required if CouchDB is secured)
* **NODE_PATH** (required) should point to the node_modules folder of the Node-Plugin-Architecture base installation
* **WORKSPACE_LOC** (optional) default to ./workspace
* **PERSIST_HTTP_SESSION**  (optional true/false) default to false
* **HTTP_SESSION_TIMEOUT**  (optional) inactivity timeout in secondes - default to 900

Other usefull environment variables for APAF:

* **APPLICATION** (optional) the NPA application to start - defaults to the NPA `test` application
* **LOG_DIR** (optional) the location for log files - defaults to './'
* **LOG_LEVEL** (optional) the initial logging level - defaults to 'info' - one of 'info', 'fine' and 'finest'
* **PORT** (optional) the HTTP server listening port - defaults to 9080
* **ENV_NAME** (optional) a name for the process that makes it easier to retrieve
* **SMTP_USER** (optional) the username for the SMTP provider
* **SMTP_PASSWD** (optional) the password for the SMTP provider
* **HTTP_SESSION_CLEANER_TIMEOUT**  (optional) delay in sec. between HTTP Session reaper thread loops - default to 120

If the HTTP Session is configured as persistent:

* **NPA_SESSION_COUCH_DB_HOST** (optional) the hostname for the CouchDB instance hosting the session database - default to 127.0.0.1
* **NPA_SESSION_COUCH_DB_PORT** (optional) the port for the CouchDB instance hosting the session database - default to 5984
* **NPA_SESSION_COUCH_DB_USER** (required if CouchDB is secured)
* **NPA_SESSION_COUCH_DB_USER_PASSWD** (required if CouchDB is secured)

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

### Using an ENV_FILE

As supported by NPA, using an ENV_FILE may be a better choice to select between different types of environment (production, development, test...)

Create an ENV_FILE config/devConfig.env with the following content:

```bash
APAF_COUCH_DB_HOST=<couchdb-host>
APAF_COUCH_DB_PORT=5984
APAF_COUCH_DB_USER=<couchdb-user>
APAF_COUCH_DB_USER_PASSWD=<couchdb-password>
COUCH_DATABASE_PREFIX=apaf_
ENABLE_SSL=false
HTTP_SESSION_TIMEOUT=900
PERSIST_HTTP_SESSION=false
NPA_SESSIONS_COUCH_DB_HOST=
NPA_SESSIONS_COUCH_DB_PORT=5984
NPA_SESSIONS_COUCH_DB_USER=
NPA_SESSIONS_COUCH_DB_USER_PASSWD=
WORKSPACE_LOC=<apaf-workspace-directory>
REGISTRY_HOST=twinxeon.online
REGISTRY_PORT=5008
REGISTRY_SSL_ENABLED=true
SMTP_USER=<mailbox-user>
SMTP_PASSWD=<mailbox-user-password>
LOG_DIR=./logs
LOG_LEVEL=info
SSL_CERTIFICATE=./ssl/apaf-certificate.pem
SSL_PRIVATE_KEY=./ssl/apaf-private-key.pem
PORT=9090
APPLICATION=apaf
APPLICATION_NAME=APAF
APAF_INSTALLATION=<path-to-NPA-installation-configuration-file>
```

A typical command-line may then be:

```bash
$>export NODE_PATH=./node_modules
$>export ENV_FILE=./config/devConfig.env
$>node app.js 
```

## Databases

Upon successfull startup, APAF will create the following CouchDB databases:

* apaf_users: contains APAF user definitions - for localy authenticated users the record only contains the md5 of the password
* apaf_groups: defines Groups of APAF Users - Groups are associated with Security Roles to grant access to APAF features
* apaf_roles: defines APAF and User-defined Security Roles
* apaf_rule_data: defines User-defined rule data used to populate select lists
* apaf_datatypes: defines User-designed datatypes that may be used in custom databases, forms...
* apaf_fragments: defines the fragments of code used to assemble APAF applications
* apaf_applications: defines APAF User-defined applications - published ones will appear on the Applications menu
* apaf_scheduler: defines scheduled tasks or workflows managed by the APAF runtime
* apaf_tokens: defines User-managed security tokens associated with Servlet URLs
* apaf_workflows: defines User-designed workflows  

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
* operator: default role for accessing custom applications
* manageUser: required role for administrative tasks such as creating/updating/deleting a User
* manageGroup: required role for administrative tasks such as creating/updating/deleting a Group
* coreServices: required role for using most of the Core APAF services such as mail, REST api calls or System calls

![The APAF Security Roles Management Screen](https://github.com/renaudet/apaf/blob/main/screenshots/rolesPage.png?raw=true)

## User Groups

Creating Groups of Users helps define required security roles for categories of users. The same user may be a member of several Groups at the same time.

![The APAF Groups Management Screen](https://github.com/renaudet/apaf/blob/main/screenshots/groupsPage.png?raw=true)

## APAF Users

APAF Users must be defined in the APAF CouchDB database. The `domain` property makes it possible to use an external authentication mechanism like an LDAP registry.

By default, the `local` domain authenticates the user credential using an equality check on the password's md5 hash value stored in the User's record.

![The APAF Users Management Screen](https://github.com/renaudet/apaf/blob/main/screenshots/usersPage.png?raw=true)

The User page is not intended to be a password-management facility. In case an update operation is done on the page, the password is updated with all the other fields.

## Fragments of code

The main APAF concept is the notion of fragment. A fragment is a piece of code defined from within the APAF development interface and stored in the APAF CouchDB database.
Several components in APAF may use fragments of code for customization purpose. The most obvious example of such customizations are APAF Applications.

![The APAF Code Fragment definition page](https://github.com/renaudet/apaf/blob/main/screenshots/fragmentsPage.png?raw=true)

Fragments are written in Javascript. Depending on the purpose for this fragment, the source code may have some requirement such as a specific entry point.

```javascript
main = function(){
	let html = '';
    html += '<h1>Hello, World!</h1>';
    $('#workArea').html(html);
}
```
The built-in editor offers a facility known as the APAF Snippet Library that helps implement those requirements and gives usefull code examples to best use the APIs.

![The APAF Snippet Library](https://github.com/renaudet/apaf/blob/main/screenshots/snippetLibrary.png?raw=true)

For `servlet` type of code fragment, extra parameters are required such as an alias and an activation switch.

![Servlets require extra parameters](https://github.com/renaudet/apaf/blob/main/screenshots/servletDefinition.png?raw=true)

A Servlet is a specific type of code fragment that executes server-side and can be called as a REST API endpoint using an URI such as `/apaf-api/servlet/<alias>`
Thus, Servlet are the number one option for implementing micro-services using APAF. See the chapter related to Security Token for more information

## Custom Datatypes

APAF allows the developer to define its own datatypes. Datatypes are lightweight object structures written in JSON that can be used as a database schema if declared persistent.
A new CouchDB database will be created if required to store records following the custom datatype schema, but mapping an existing database is also possible.
 
![Custom Datatype definition](https://github.com/renaudet/apaf/blob/main/screenshots/datatypesPage.png?raw=true)

The custom datatype editor offers a specific editor to define custom fields within a datatype using many supported built-in types: 

* text
* integer
* boolean
* date
* range
* fixed-choice selection
* exclusive selection
* ... and more

![The Custom Datatype field definition dialog](https://github.com/renaudet/apaf/blob/main/screenshots/newDatatypeFieldDialog.png?raw=true)

APAF offers SQL-like facilities to establish relationships between datatypes such as one-to-one and one-to-many relationships.
APAF will generate ready-to-use, customizable forms to help create / update records according to the Datatype schema. The generated form can include inline help, automatique validation and custom handlers so that the content of a field may be defined after the content of another field for example

The fields list...
![Custom Datatype fields](https://github.com/renaudet/apaf/blob/main/screenshots/fieldList.png?raw=true)

And the generated form by APAF
![Generated form](https://github.com/renaudet/apaf/blob/main/screenshots/generatedForm.png?raw=true)

## The Custom Datatype Browser

For persistent Datatypes, APAF delivers an integrated database browser based on the Datatype schema. APAF will generate tables and input forms to help create, read, update and delete records of these user-defined Datatypes

![Custom Datatype Browser](https://github.com/renaudet/apaf/blob/main/screenshots/browsingCustomDatatypes.png?raw=true)

## Workspace

APAF applications may use the local filesystem as temporary working space, storage space or event document root for web-native resource types.
The `manage APIs` menu gives administrators access to a remote workspace explorer with a tree-like structure and integrated editor for text-based file resources

![The APAF Workspace manager](https://github.com/renaudet/apaf/blob/main/screenshots/workspacePage.png?raw=true)
 
The base workspace location is defined by the `WORKSPACE_LOC` environment variable at server startup. Then, the administrator can create Projects in the workspace.
Application developers may refer to these project by name to work on file resources.
 
The files stored in the project or their sub-folders can be downloaded using a specific API call `/apaf-workspace/binaryFile/<base64-encoded-path-relative-to-workspace>`
 
## Workflows
 
One of the most advanced feature of APAF, the workflow editor, enables synchronous-like workflow development using built-in or custom nodes.
 
![The APAF Workflow Editor](https://github.com/renaudet/apaf/blob/main/screenshots/workflowEditor.png?raw=true)
 
The developer designs the workflow by draging / droping nodes from the palette to the diagram area and then creating connections between nodes to define the flow of control between activities.
 
The integrated execution console enables developers to test their workflow from within the workflow editor
 
![The APAF Workflow execution console](https://github.com/renaudet/apaf/blob/main/screenshots/workflowExecution.png?raw=true)
 
These workflows may then be called from custom APAF applications as reusable business components. It also greatly reduce the time needed to develop complex asynchronous applications when multiple calls to REST providers are expected for example.

## Security Token

An APAF fragment may be tagged as a Servlet. In this case, a Servlet `alias` is defined so that the Servlet may be invoked using the relative URI `/apaf-api/servlet/<alias>`. But as a Servlet is a secured resource, the security layer will look for an existing session or a credential in the incomming request (Authorization header with base64 encoded user/password).

A convenient way to provide a self-sufficient URL is to generate a token for the Servlet URL and add this token to the request, either using the `?token=<token>` url parameter or by providing a request *Bearer* header.  

Tokens are generated using the `Administration / Manage APIs / Security Tokens` page. Click the `Create a new token...` icon then provide the Servlet relative *URI* and the credential to use for this token. At runtime, the Servlet invocation will assume the identity for the provided credential.