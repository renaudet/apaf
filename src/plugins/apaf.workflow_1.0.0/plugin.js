/*
 * plugin.js - APAF Workflows support plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const WorkflowEngine = require('./workflowEngine.js');
const moment = require('moment');
const SECURITY_SERVICE_NAME = 'apaf-security';
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const WORKFLOW_DATATYPE = 'workflow';

var plugin = new ApafPlugin();

plugin.queryWorkflowHandler = function(req,res){
	plugin.debug('->queryWorkflowHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workflow.query.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryWorkflowHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let query = {};
			if(typeof req.body=='object'){
				query = req.body;
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(WORKFLOW_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-queryWorkflowHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryWorkflowHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.createWorkflowHandler = function(req,res){
	plugin.debug('->createWorkflowHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workflow.create.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createWorkflowHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.created = moment().format('YYYY/MM/DD HH:mm:ss');
			record.createdBy = user.login;
			record.lastUpdated = moment().format('YYYY/MM/DD HH:mm:ss');
			record.lastUpdatedBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(WORKFLOW_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-createWorkflowHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createWorkflowHandler()');
					res.json({"status": 200,"message": "created","data": data});
				}
			});
		}
	});
}

plugin.updateWorkflowHandler = function(req,res){
	plugin.debug('->updateWorkflowHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workflow.update.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateWorkflowHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.lastUpdated = moment().format('YYYY/MM/DD HH:mm:ss');
			record.lastUpdatedBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.updateRecord(WORKFLOW_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-updateWorkflowHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-updateWorkflowHandler()');
					res.json({"status": 200,"message": "updated","data": data});
				}
			});
		}
	});
}

plugin.deleteWorkflowHandler = function(req,res){
	plugin.debug('->deleteWorkflowHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workflow.delete.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteWorkflowHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let workflowId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(WORKFLOW_DATATYPE,{"id": workflowId},function(err,data){
				if(err){
					plugin.debug('<-deleteWorkflowHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteWorkflowHandler()');
					res.json({"status": 200,"message": "deleted","data": data});
				}
			});
		}
	});
}

plugin.getByNameHandler = function(req,res){
	plugin.debug('->getByNameHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workflow.get.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getByNameHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let workflowName = req.params.workflowName;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(WORKFLOW_DATATYPE,{"selector": {"name": {"$eq": workflowName}}},function(err,data){
				if(err){
					plugin.debug('<-getByNameHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data && data.length>0){
						plugin.debug('<-getByNameHandler()');
						res.json({"status": 200,"message": "ok","data": data[0]});
					}else{
						plugin.debug('<-getByNameHandler()');
						res.json({"status": 500,"message": err,"data": []});
					}
				}
			});
		}
	});
}

plugin.executeWorkflowHandler = function(req,res){
	plugin.debug('->executeWorkflowHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workflow.execute.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-executeWorkflowHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let workflowId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(WORKFLOW_DATATYPE,{"id": workflowId},function(err,workflow){
				if(err){
					plugin.debug('<-executeWorkflowHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					let engine = new WorkflowEngine(plugin,{});
					engine.setEventListener(function(event){
						if('stop'==event.type){
							plugin.debug('<-executeWorkflowHandler()');
							res.json({"status": 200,"message": "executed","data": engine.runtimeContext});
						}
						if('debug'==event.type){
							plugin.debug(event.source+' '+event.data);
						}
						if('log'==event.type){
							plugin.info(event.source+' '+event.data);
						}
						if('error'==event.type){
							plugin.error(event.source+' '+event.data);
						}
					});
					let runtimeContext = req.body;
					if(typeof runtimeContext=='undefined' || runtimeContext==null){
						runtimeContext = {};
					}
					engine.start(workflow,runtimeContext);
				}
			});
		}
	});
}

module.exports = plugin;