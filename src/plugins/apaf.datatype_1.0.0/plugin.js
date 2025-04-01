/*
 * plugin.js - APAF Datatype handler plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const APAF_DATATYPE_DB_REF = 'apaf_datatypes';
const COUCH_SERVICE_ID = 'couchdb';
const READY_STATE = 'apaf.datatype.ready';
const APPLICATION_STARTED_STATE = 'application.started';
const INITIALIZER_DELAY = 5000;

var plugin = new ApafPlugin();
plugin.cacheById = {};
plugin.baseDatasourceConfig = null;

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
	if('apaf.datatype.base.datatype'==extensionPointConfig.point){
		let datatype = extensionPointConfig.datatype;
		this.info('registering static Datatype '+datatype.name+' from '+extenderId);
		this.trace(JSON.stringify(datatype,null,'\t'));
		this.registerDatatype(datatype);
	}
	if('apaf.datatype.object.initializer'==extensionPointConfig.point){
		this.registerStateListener(READY_STATE,function(){
			plugin.info('initializing object for datatype '+extensionPointConfig.datatype+' from '+extenderId);
			plugin.trace('data: '+JSON.stringify(extensionPointConfig.data,null,'\t'));
			plugin.initializeObject(extensionPointConfig.datatype,extensionPointConfig.data);
		});
	}
}

plugin.beforeExtensionPlugged = function(){
	this.trace('->beforeExtensionPlugged()');
	for(var i=0;i<this.config.extends.length;i++){
		let extent = this.config.extends[i];
		if('npa.couchdb.adapter.datasource'==extent.point){
			this.baseDatasourceConfig = extent;
			this.trace('setting base datasource configuration:');
			this.trace(JSON.stringify(this.baseDatasourceConfig,null,'\t'));
		}
	}
	let couchService = plugin.getService(COUCH_SERVICE_ID);
	couchService.checkDatabase(APAF_DATATYPE_DB_REF,function(err,exists){
		if(err){
			plugin.error('Error checking for CouchDB database '+APAF_DATATYPE_DB_REF);
			plugin.error(JSON.stringify(err));
		}else{
			if(exists){
				plugin.info('Datatype database already exists');
				plugin.loadCustomDatatypes();
				plugin.trace('<-beforeExtensionPlugged()');
			}else{
				plugin.info('Datatype database not found - creating...');
				couchService.createDatabase(APAF_DATATYPE_DB_REF,function(err,created){
					if(err){
						plugin.error('Error creating CouchDB database '+APAF_DATATYPE_DB_REF);
						plugin.error(JSON.stringify(err));
						plugin.trace('<-beforeExtensionPlugged()');
					}else{
						plugin.loadCustomDatatypes();
						plugin.trace('<-beforeExtensionPlugged()');
					}
				});
			}
		}
	});
}

plugin.loadCustomDatatypes = function(){
	this.trace('->loadCustomDatatypes()');
	this.debug('loading custom Datatypes..');
	let couchService = plugin.getService(COUCH_SERVICE_ID);
	couchService.query(APAF_DATATYPE_DB_REF,{},function(err,records){
		if(err){
			plugin.error('unable to load custom Datatypes:');
			plugin.error(JSON.stringify(err));
		}else{
			for(var i=0;i<records.length;i++){
				let customDatatype = records[i];
				plugin.debug('found custom datatype '+customDatatype.name);
				plugin.registerDatatype(customDatatype);
			}
			plugin.setState(READY_STATE);
		}
		plugin.trace('<-loadCustomDatatypes()');
	});
}

plugin.registerDatatype = function(datatype){
	this.trace('->registerDatatype()');
	this.debug('datatype:');
	this.debug(JSON.stringify(datatype,null,'\t'));
	// look for the name/id in cache
	let id = datatype.id;
	if(!datatype.builtIn){
		id = datatype.name;
	}
	if(typeof this.cacheById[id]!='undefined'){
		this.error('duplicated Datatype ID detected: '+id);
		this.trace('<-registerDatatype()');
	}else{
		this.cacheById[id] = datatype;
		if(datatype.persistent && typeof datatype.database!='undefined' && datatype.database.length>0){
			this.registerDatasource(datatype);
		}
		this.trace('<-registerDatatype()');
	}
}

plugin.registerDatasource = function(datatype){
	this.trace('->registerDatasource()');
	let id = datatype.id;
	if(!datatype.builtIn){
		id = datatype.name;
	}
	let couchService = plugin.getService(COUCH_SERVICE_ID);
	let datasource = Object.assign({},this.baseDatasourceConfig);
	datasource.id = 'apaf.datatype.datasource.'+id;
	datasource.dbname = datatype.database;
	datasource.reference = id;
	couchService.registerDatasource(datasource);
	// create database if not exists - ignore the datatype ref as it is for sure created at plugin initialization time
	if(datasource.reference!='datatype'){
		couchService.checkDatabase(datasource.reference,function(err,exists){
			if(err){
				plugin.error('Error checking for CouchDB database '+datasource.reference);
				plugin.error(JSON.stringify(err));
				plugin.trace('<-registerDatasource()');
			}else{
				if(!exists){
					couchService.createDatabase(datasource.reference,function(err,created){
						if(err){
							plugin.error('Error creating CouchDB database '+datasource.reference);
							plugin.error(JSON.stringify(err));
						}
						plugin.trace('<-registerDatasource()');
					});
				}else{
					plugin.trace('<-registerDatasource()');
				}
			}
		});
	}
}

plugin.checkDatatype = function(datatypeId,then){
	this.trace('->checkDatatype('+datatypeId+')');
	let datatype = this.cacheById[datatypeId];
	if(typeof datatype!='undefined'){
		if(datatype.persistent && typeof datatype.database!='undefined'){
			this.trace('<-checkDatatype() - found');
			then(null,datatype);
		}else{
			this.trace('<-checkDatatype() - error');
			then('datatype ID #'+datatypeId+' is not persistent',null);
		}
	}else{
		this.trace('<-checkDatatype() - error');
		then('unknown datatype ID #'+datatypeId,null);
	}
}

plugin.refreshDatatype = function(datatype,deleted=false){
	this.trace('->refreshDatatype()');
	this.debug('datatype: '+JSON.stringify(datatype));
	this.debug('delete: '+deleted);
	let couchService = plugin.getService(COUCH_SERVICE_ID);
	let oldEntry = this.cacheById[datatype.name];
	if(typeof oldEntry!='undefined'){
		delete this.cacheById[datatype.name];
		if(oldEntry.persistent){
			couchService.unregisterDatasource('apaf.datatype.datasource.'+datatype.name);
		}
	}
	if(!deleted){
		this.registerDatatype(datatype);
	}
	this.trace('<-refreshDatatype()');
}

plugin.query = function(datatypeId,query,callback){
	this.trace('->query('+datatypeId+')');
	this.debug('datatypeId: '+datatypeId);
	this.debug('query: '+JSON.stringify(query));
	this.checkDatatype(datatypeId,function(err,datatype){
		if(err){
			plugin.trace('<-query() - error');
			callback(err,null);
		}else{
			plugin.trace('<-query()');
			let couchService = plugin.getService(COUCH_SERVICE_ID);
			couchService.query(datatypeId,query,callback);
		}
	});
}

plugin.findByPrimaryKey = function(datatypeId,data,callback){
	this.trace('->findByPrimaryKey('+datatypeId+')');
	this.debug('datatypeId: '+datatypeId);
	this.debug('data: '+JSON.stringify(data));
	this.checkDatatype(datatypeId,function(err,datatype){
		if(err){
			plugin.trace('<-findByPrimaryKey() - error');
			callback(err,null);
		}else{
			plugin.trace('<-findByPrimaryKey()');
			let couchService = plugin.getService(COUCH_SERVICE_ID);
			couchService.findByPrimaryKey(datatypeId,data,callback);
		}
	});
}

plugin.createRecord = function(datatypeId,data,callback){
	this.trace('->createRecord('+datatypeId+')');
	this.debug('datatypeId: '+datatypeId);
	this.debug('data: '+JSON.stringify(data));
	this.checkDatatype(datatypeId,function(err,datatype){
		if(err){
			plugin.trace('<-createRecord() - error');
			callback(err,null);
		}else{
			plugin.trace('<-createRecord()');
			let couchService = plugin.getService(COUCH_SERVICE_ID);
			couchService.createRecord(datatypeId,data,callback);
		}
	});
}

plugin.updateRecord = function(datatypeId,data,callback){
	this.trace('->updateRecord('+datatypeId+')');
	this.debug('datatypeId: '+datatypeId);
	this.debug('data: '+JSON.stringify(data));
	this.checkDatatype(datatypeId,function(err,datatype){
		if(err){
			plugin.trace('<-updateRecord() - error');
			callback(err,null);
		}else{
			plugin.trace('<-updateRecord()');
			let couchService = plugin.getService(COUCH_SERVICE_ID);
			couchService.updateRecord(datatypeId,data,callback);
		}
	});
}

plugin.deleteRecord = function(datatypeId,data,callback){
	this.trace('->deleteRecord('+datatypeId+')');
	this.debug('datatypeId: '+datatypeId);
	this.debug('data: '+JSON.stringify(data));
	this.checkDatatype(datatypeId,function(err,datatype){
		if(err){
			plugin.trace('<-deleteRecord() - error');
			callback(err,null);
		}else{
			plugin.trace('<-deleteRecord()');
			let couchService = plugin.getService(COUCH_SERVICE_ID);
			couchService.deleteRecord(datatypeId,data,callback);
		}
	});
}

plugin.initializeObject = function(datatype,data,then){
	this.trace('->initializeObject('+datatype+')');
	this.debug('object to initialize: '+JSON.stringify(data));
	let query = {};
	let selector = {"$and": []};
	for(var fieldName in data){
		let fieldValue = data[fieldName];
		let condition = {};
		condition[fieldName] = {};
		condition[fieldName]['$eq'] = fieldValue
		selector['$and'].push(condition);
	}
	query.selector=selector;
	this.query(datatype,query,function(err,resultSet){
		if(err){
			plugin.error('An error occured looking up for an existing "'+datatype+'" record with selector '+JSON.stringify(selector));
			plugin.error(JSON.stringify(err));
			plugin.trace('<-initializeObject()');
			//then();
		}else{
			if(resultSet && resultSet.length==0){
				plugin.debug('object not found in database! - creating');
				plugin.createRecord(datatype,data,function(err,createdRecord){
					if(err){
						plugin.error('An error occured creating a new "'+datatype+'" record');
						plugin.error(JSON.stringify(err));
					}else{
						plugin.info('A new record of type "'+datatype+'" was created: '+JSON.stringify(createdRecord));
					}
					plugin.trace('<-initializeObject()');
					//then();
				});
			}else{
				plugin.debug('object already exists');
				plugin.trace('<-initializeObject()');
				//then();
			}
		}
	})
}

module.exports = plugin;