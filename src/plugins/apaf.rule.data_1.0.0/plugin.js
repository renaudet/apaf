/*
 * plugin.js - APAF Rule-data managing plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const RULEDATA_DATATYPE_NAME = 'ruleData';

var plugin = new ApafPlugin();

plugin.getRuleByName = function(ruleName,next){
	this.debug('->getRuleByName()');
	var query = {"selector": {"name": {"$eq": ruleName}}};
	let datatypePlugin = this.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	datatypePlugin.query(RULEDATA_DATATYPE_NAME,query,function(err,data){
		if(err){
			plugin.debug('<-getRuleByName() - error');
			next(err,null);
		}else{
			if(data.length>0){
				plugin.debug('<-getRuleByNameHandler() - success');
				next(null,data[0]);
			}else{
				plugin.debug('<-getRuleByNameHandler() - not found');
				next('Not found',null);
			}
		}
	});
}

plugin.queryRuleHandler = function(req,res){
	plugin.debug('->queryRuleHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.rule.data.query.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryRuleHandler() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			var query = {};
			if(typeof req.body=='object'){
				query = req.body;
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(RULEDATA_DATATYPE_NAME,query,function(err,data){
				if(err){
					plugin.debug('<-queryRuleHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryRuleHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.getRuleByNameHandler = function(req,res){
	plugin.debug('->getRuleByNameHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.rule.data.find.by.name.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getRuleByNameHandler() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			var requestedRuleDataName = req.params.name
			var query = {"selector": {"name": {"$eq": requestedRuleDataName}}};
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(RULEDATA_DATATYPE_NAME,query,function(err,data){
				if(err){
					plugin.debug('<-getRuleByNameHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data.length>0){
						plugin.debug('<-getRuleByNameHandler()');
						res.json({"status": 200,"message": "ok","data": data[0]});
					}else{
						plugin.debug('<-getRuleByNameHandler()');
						res.json({"status": 404,"message": "not found","data": []});
					}
				}
			});
		}
	});
}

plugin.findRuleByPrimaryKeyHandler = function(req,res){
	plugin.debug('->findRuleByPrimaryKeyHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.rule.data.find.by.id.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-findRuleByPrimaryKeyHandler() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			var id = req.params.id
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(RULEDATA_DATATYPE_NAME,{"id": id},function(err,data){
				if(err){
					plugin.debug('<-findRuleByPrimaryKeyHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data && data.length>0){
						plugin.debug('<-findRuleByPrimaryKeyHandler()');
						res.json({"status": 200,"message": "ok","data": data[0]});
					}else{
						plugin.debug('<-findRuleByPrimaryKeyHandler()');
						res.json({"status": 404,"message": "not found","data": []});
					}
				}
			});
		}
	});
}

plugin.createRuleHandler = function(req,res){
	plugin.debug('->createRuleHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.rule.data.create.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createRuleHandler() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(RULEDATA_DATATYPE_NAME,record,function(err,data){
				if(err){
					plugin.debug('<-createRuleHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createRuleHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
				}
			});
		}
	});
}

plugin.updateRuleHandler = function(req,res){
	plugin.debug('->updateRuleHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.rule.data.update.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateRuleHandler() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.updateRecord(RULEDATA_DATATYPE_NAME,record,function(err,data){
				if(err){
					plugin.debug('<-updateRuleHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-updateRuleHandler() - success');
					res.json({"status": 200,"message": "updated","data": data});
				}
			});
		}
	});
}

plugin.deleteRuleHandler = function(req,res){
	plugin.debug('->deleteRuleHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.rule.data.delete.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteRuleHandler() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(RULEDATA_DATATYPE_NAME,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-deleteRuleHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteRuleHandler() - success');
					res.json({"status": 200,"message": "deleted","data": data});
				}
			});
		}
	});
}

module.exports = plugin;