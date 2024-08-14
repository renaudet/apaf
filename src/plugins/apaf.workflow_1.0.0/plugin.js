/*
 * plugin.js - APAF Workflows support plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const WorkflowEngine = require('./workflowEngine.js');
const moment = require('moment');
const SECURITY_SERVICE_NAME = 'apaf-security';
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const FRAGMENT_DATATYPE = 'fragment';
const WORKFLOW_DATATYPE = 'workflow';
const WORKFLOW_TIMEOUT = 5*60*1000;

function sortOn(list,attributeName,descending=true){
	if(typeof attributeName=='undefined'){
		return list;
	}else{
		if(list.length>1){
			for(var i=0;i<list.length-1;i++){
				for(var j=i+1;j<list.length;j++){
					var listi = list[i];
					var listj = list[j];
					if(typeof listj[attributeName]!='undefined' && typeof listi[attributeName]!='undefined'){
						if(Number.isInteger(listj[attributeName])){
							if(listj[attributeName]<listi[attributeName]){
								var tmp = listi;
								list[i] = listj;
								list[j] = tmp;
							}
						}else{
							if(descending){
								if(listj[attributeName].localeCompare(listi[attributeName])<0){
									var tmp = listi;
									list[i] = listj;
									list[j] = tmp;
								}
							}else{
								if(listj[attributeName].localeCompare(listi[attributeName])>0){
									var tmp = listi;
									list[i] = listj;
									list[j] = tmp;
								}
							}
						}
					}
				}
			}
		}
		return list;
	}
}

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
			let workflowVersion = req.params.workflowVersion;
			plugin.debug('request to execute workflow "'+workflowName+'" version '+workflowVersion);
			let query = {"selector": {"$and": [{"name": {"$eq": workflowName}}, {"version": {"$eq": workflowVersion}}]}};
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(WORKFLOW_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-getByNameHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data && data.length>0){
						plugin.debug('<-getByNameHandler()');
						res.json({"status": 200,"message": "ok","data": data[0]});
					}else{
						plugin.debug('<-getByNameHandler()');
						res.json({"status": 404,"message": "invalid name or version","data": []});
					}
				}
			});
		}
	});
}

plugin.loadCustomNodeFragments = function(then){
	plugin.debug('->loadCustomNodeFragments()');
	let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	let query = {"selector": {"type": {"$eq": "workflowNode"}}};
	datatypePlugin.query(FRAGMENT_DATATYPE,query,function(err, fragments){
		if(err){
			plugin.error('Error loading custom node fragments: '+err);
			plugin.debug('<-loadCustomNodeFragments() - error');
			then([]);
		}else{
			plugin.debug('<-loadCustomNodeFragments() - success');
			then(fragments);
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
					plugin.debug('execution requested for Workflow "'+workflow.name+'" v'+workflow.version);
					let engine = new WorkflowEngine(plugin,user,{"global.timeout": WORKFLOW_TIMEOUT});
					plugin.loadCustomNodeFragments(function(fragments){
						for(var i=0;i<fragments.length;i++){
							engine.registerCustomNode(fragments[i]);
						}
						engine.setEventListener(function(event){
							runtimeContext['_console'].push(event);
							if('stop'==event.type){
								plugin.debug('<-executeWorkflowHandler()');
								res.json({"status": 200,"message": "executed","data": engine.runtimeContext});
							}
							if('debug'==event.type){
								plugin.debug(event.source+' '+event.data);
							}
							if('warning'==event.type){
								plugin.info(event.source+' '+event.data);
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
						runtimeContext['_console'] = [];
						engine.start(workflow,runtimeContext);
					});
				}
			});
		}
	});
}

plugin.executeWorkflow = function(workflowName,workflowVersion,owner,runtimeContext,then){
	this.debug('->executeWorkflow()');
	this.trace('workflowName: '+workflowName);
	this.trace('workflowVersion: '+workflowVersion);
	this.trace('owner: '+owner.login);
	this.trace('runtimeContext: '+JSON.stringify(runtimeContext));
	let datatypePlugin = this.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	let query = {"selector": {"name": {"$eq": workflowName}}};
	if(workflowVersion!=null && workflowVersion.length>0){
		query =  {"selector": {"$and": [{"name": {"$eq": workflowName}}, {"version": {"$eq": workflowVersion}}]}};
	}
	/*datatypePlugin.query(WORKFLOW_DATATYPE,query,function(err,workflows){
		if(err){
			plugin.debug('<-executeWorkflow() - error looking up for workflow');
			then(err,null);
		}else{
			if(workflows && workflows.length>0){
				let sortedResultSet = workflows.length==1?workflows:sortOn(workflows,'version',false);
				let workflow = sortedResultSet[0];
				//let workflow = workflows[0];
				plugin.debug('found Workflow "'+workflow.name+'" v'+workflow.version+' with #ID: '+workflow.id);
				let engine = new WorkflowEngine(plugin,owner,{"global.timeout": WORKFLOW_TIMEOUT});
				plugin.loadCustomNodeFragments(function(fragments){
					for(var i=0;i<fragments.length;i++){
						engine.registerCustomNode(fragments[i]);
					}
					engine.setEventListener(function(event){
						runtimeContext['_console'].push(event);
						if('stop'==event.type){
							plugin.debug('<-executeWorkflow() - stop event received');
							then(null,engine.runtimeContext);
						}
						if('debug'==event.type){
							plugin.debug(event.source+' '+event.data);
						}
						if('warning'==event.type){
							plugin.info(event.source+' '+event.data);
						}
						if('log'==event.type){
							plugin.info(event.source+' '+event.data);
						}
						if('error'==event.type){
							plugin.error(event.source+' '+event.data);
						}
					});
					if(typeof runtimeContext=='undefined' || runtimeContext==null){
						runtimeContext = {};
					}
					runtimeContext['_console'] = [];
					engine.start(workflow,runtimeContext);
				});
			}else{
				then('unknown Workflow',null);
			}
		}
	});*/
	this.queryAndExecuteWorkflow(query,owner,runtimeContext,then);
}

plugin.queryAndExecuteWorkflow = function(query,owner,runtimeContext,then){
	this.debug('->queryAndExecuteWorkflow()');
	this.trace('query: '+JSON.stringify(query));
	this.trace('owner: '+owner.login);
	this.trace('runtimeContext: '+JSON.stringify(runtimeContext));
	let datatypePlugin = this.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	datatypePlugin.query(WORKFLOW_DATATYPE,query,function(err,workflows){
		if(err){
			plugin.debug('<-queryAndExecuteWorkflow() - error looking up for workflow');
			then(err,null);
		}else{
			if(workflows && workflows.length>0){
				let sortedResultSet = workflows.length==1?workflows:sortOn(workflows,'version',false);
				let workflow = sortedResultSet[0];
				plugin.debug('found Workflow "'+workflow.name+'" v'+workflow.version+' with #ID: '+workflow.id);
				let engine = new WorkflowEngine(plugin,owner,{"global.timeout": WORKFLOW_TIMEOUT});
				plugin.loadCustomNodeFragments(function(fragments){
					for(var i=0;i<fragments.length;i++){
						engine.registerCustomNode(fragments[i]);
					}
					engine.setEventListener(function(event){
						runtimeContext['_console'].push(event);
						if('stop'==event.type){
							plugin.debug('<-queryAndExecuteWorkflow() - stop event received');
							then(null,engine.runtimeContext);
						}
						if('debug'==event.type){
							plugin.debug(event.source+' '+event.data);
						}
						if('warning'==event.type){
							plugin.info(event.source+' '+event.data);
						}
						if('log'==event.type){
							plugin.info(event.source+' '+event.data);
						}
						if('error'==event.type){
							plugin.error(event.source+' '+event.data);
						}
					});
					if(typeof runtimeContext=='undefined' || runtimeContext==null){
						runtimeContext = {};
					}
					runtimeContext['_console'] = [];
					engine.start(workflow,runtimeContext);
					plugin.debug('<-queryAndExecuteWorkflow() - workflow started');
				});
			}else{
				plugin.debug('<-queryAndExecuteWorkflow() - no workflow found matching query parameters');
				then('unknown Workflow',null);
			}
		}
	});
}

module.exports = plugin;