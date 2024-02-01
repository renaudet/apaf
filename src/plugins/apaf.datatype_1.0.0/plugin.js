/*
 * plugin.js - APAF Datatype handler plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const APAF_DATATYPE_DB_REF = 'apaf_datatypes';

var plugin = new ApafPlugin();
plugin.cacheByName = {};
plugin.cacheById = {};
plugin.baseDatasourceConfig = null;

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
	if('apaf.datatype.base.datatype'==extensionPointConfig.point){
		let datatype = extensionPointConfig.datatype;
		this.info('registering static Datatype '+datatype.name);
		this.trace(JSON.stringify(datatype,null,'\t'));
		this.registerDatatype(datatype);
	}
}

plugin.beforeExtensionPlugged = function(){
	for(var i=0;i<this.config.extends.length;i++){
		let extent = this.config.extends[i];
		if('npa.couchdb.adapter.datasource'==extent.point){
			this.baseDatasourceConfig = extent;
			this.trace('setting base datasource configuration:');
			this.trace(JSON.stringify(this.baseDatasourceConfig,null,'\t'));
		}
	}
	let couchService = plugin.getService('couchdb');
	couchService.checkDatabase(APAF_DATATYPE_DB_REF,function(err,exists){
		if(err){
			plugin.error('Error checking for CouchDB database '+APAF_DATATYPE_DB_REF);
			plugin.error(JSON.stringify(err));
		}else{
			if(exists){
				plugin.info('Datatype database already exists');
				plugin.loadCustomDatatypes();
			}else{
				plugin.info('Datatype database not found - creating...');
				couchService.createDatabase(APAF_DATATYPE_DB_REF,function(err,created){
					if(err){
						plugin.error('Error creating CouchDB database '+APAF_DATATYPE_DB_REF);
						plugin.error(JSON.stringify(err));
					}else{
						plugin.loadCustomDatatypes();
					}
				});
			}
		}
	});
}

plugin.loadCustomDatatypes = function(){
	this.trace('->loadCustomDatatypes()');
	this.debug('loading custom Datatypes..');
	let couchService = plugin.getService('couchdb');
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
		}
		plugin.trace('<-loadCustomDatatypes()');
	});
}

plugin.registerDatatype = function(datatype){
	this.trace('->registerDatatype()');
	this.debug('datatype:');
	this.debug(JSON.stringify(datatype,null,'\t'));
	// look for the name/id in cache
	if(typeof this.cacheByName[datatype.name]!='undefined'){
		this.error('duplicated Datatype name detected: '+datatype.name);
		this.trace('<-registerDatatype()');
	}else{
		if(typeof this.cacheById[datatype.id]!='undefined'){
			this.error('duplicated Datatype ID detected: '+datatype.id);
			this.trace('<-registerDatatype()');
		}else{
			this.cacheByName[datatype.name] = datatype;
			this.cacheById[datatype.id] = datatype;
			if(typeof datatype.database!='undefined'){
				this.registerDatasource(datatype);
			}
			this.trace('<-registerDatatype()');
		}
	}
}

plugin.registerDatasource = function(datatype){
	this.trace('->registerDatasource()');
	let couchService = plugin.getService('couchdb');
	let datasource = Object.assign({},this.baseDatasourceConfig);
	datasource.id = 'apaf.datatype.datasource.'+datatype.id;
	datasource.dbname = datatype.database;
	datasource.reference = datatype.id;
	couchService.registerDatasource(datasource);
	// create database if not exists
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

plugin.checkDatatype = function(datatypeId,then){
	this.trace('->checkDatatype('+datatypeId+')');
	let datatype = this.cacheById[datatypeId];
	if(typeof datatype!='undefined'){
		if(typeof datatype.database!='undefined'){
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
			let couchService = plugin.getService('couchdb');
			couchService.query(datatype.id,query,callback);
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
			let couchService = plugin.getService('couchdb');
			couchService.findByPrimaryKey(datatype.id,data,callback);
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
			let couchService = plugin.getService('couchdb');
			couchService.createRecord(datatype.id,data,callback);
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
			let couchService = plugin.getService('couchdb');
			couchService.updateRecord(datatype.id,data,callback);
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
			let couchService = plugin.getService('couchdb');
			couchService.deleteRecord(datatype.id,data,callback);
		}
	});
}

module.exports = plugin;