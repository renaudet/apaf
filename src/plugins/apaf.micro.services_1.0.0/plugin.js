/*
 * plugin.js - APL Micro-Services manager for APAF
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_SERVICE_NAME = 'apaf-security';
const MICRO_SERVICE_DATATYPE = 'microService';

var plugin = new ApafPlugin();

plugin.queryMicroServiceHandler = function(req,res){
	plugin.debug('->queryMicroServiceHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.micro.services.query.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryMicroServiceHandler() - security error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let query = (typeof req.body=='object') ? req.body : {};
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(MICRO_SERVICE_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-queryMicroServiceHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryMicroServiceHandler() - success');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.findMicroServiceHandler = function(req,res){
	plugin.debug('->findMicroServiceHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.micro.services.find.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-findMicroServiceHandler() - security error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(MICRO_SERVICE_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-findMicroServiceHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data){
						plugin.debug('<-findMicroServiceHandler() - success');
						res.json({"status": 200,"message": "ok","data": data});
					}else{
						plugin.debug('<-findMicroServiceHandler() - not found');
						res.json({"status": 404,"message": "not found","data": null});
					}
				}
			});
		}
	});
}

plugin.createMicroServiceHandler = function(req,res){
	plugin.debug('->createMicroServiceHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.micro.services.create.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createMicroServiceHandler() - security error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.createdBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(MICRO_SERVICE_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-createMicroServiceHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createMicroServiceHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
				}
			});
		}
	});
}

plugin.updateMicroServiceHandler = function(req,res){
	plugin.debug('->updateMicroServiceHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.micro.services.update.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateMicroServiceHandler() - security error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.lastUpdatedBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.updateRecord(MICRO_SERVICE_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-updateMicroServiceHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-updateMicroServiceHandler() - success');
					res.json({"status": 200,"message": "updated","data": data});
				}
			});
		}
	});
}

plugin.deleteMicroServiceHandler = function(req,res){
	plugin.debug('->deleteMicroServiceHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.micro.services.delete.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteMicroServiceHandler() - security error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(MICRO_SERVICE_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-deleteMicroServiceHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteMicroServiceHandler() - success');
					res.json({"status": 200,"message": "deleted","data": data});
				}
			});
		}
	});
}

module.exports = plugin;
