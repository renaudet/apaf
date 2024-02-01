/*
 * plugin.js - APAF Custom Datatype Model plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_SERVICE_NAME = 'apaf-security';
const USER_DATATYPE_DATATYPE = 'datatype';

var plugin = new ApafPlugin();

plugin.queryDatatypeHandler = function(req,res){
	plugin.debug('->queryDatatypeHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.query.user.datatype.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryDatatypeHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			var query = {};
			if(typeof req.body=='object'){
				query = req.body;
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-queryDatatypeHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryDatatypeHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.createDatatypeHandler = function(req,res){
	plugin.debug('->createDatatypeHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.create.user.datatype.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createDatatypeHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.createdBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(USER_DATATYPE_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-createDatatypeHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createDatatypeHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
				}
			});
		}
	});
}

plugin.updateDatatypeHandler = function(req,res){
	plugin.debug('->updateDatatypeHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.update.user.datatype.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateDatatypeHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.lastUpdatedBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.updateRecord(USER_DATATYPE_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-updateDatatypeHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-updateDatatypeHandler() - success');
					res.json({"status": 200,"message": "updated","data": data});
				}
			});
		}
	});
}

plugin.deleteDatatypeHandler = function(req,res){
	plugin.debug('->deleteDatatypeHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.delete.user.datatype.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteDatatypeHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(USER_DATATYPE_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-deleteDatatypeHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteDatatypeHandler() - success');
					res.json({"status": 200,"message": "deleted","data": data});
				}
			});
		}
	});
}

plugin.findDatatypeHandler = function(req,res){
	plugin.debug('->findDatatypeHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.find.user.datatype.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-findDatatypeHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(USER_DATATYPE_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-findDatatypeHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-findDatatypeHandler() - success');
					res.json({"status": 200,"message": "found","data": data});
				}
			});
		}
	});
}

module.exports = plugin;