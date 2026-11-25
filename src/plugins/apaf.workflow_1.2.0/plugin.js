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
const EXECUTION_DATATYPE = 'workflowExecution';
const GLOBAL_TIMEOUT_PROPERTY = 'workflow.global.timeout';
const RUNTIME_PROPERTIES_SERVICE_NAME = 'properties';
const DATATYPE_READY_STATE = 'apaf.datatype.ready';
const TIMESTAMP_FORMAT = 'YYYY/MM/DD HH:mm:ss';
const EXECUTION_RUNNING = 'running';
const EXECUTION_COMPLETED = 'completed';
const EXECUTION_FAILED = 'failed';
const EXECUTION_INTERRUPTED = 'interrupted';
const INITIALIZER_DELAY = 5000;

function toPlainObject(obj){
	try{
		return JSON.parse(JSON.stringify(obj));
	}catch(e){
		return {"_serializationError": e.message};
	}
}

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
plugin.nodeExtensions = [];

plugin.onConfigurationLoaded = function(){
	this.registerStateListener(DATATYPE_READY_STATE,function(){
		// leave some time to the datatype plugin to create the executions database
		setTimeout(function(){ plugin.markInterruptedExecutions(); },INITIALIZER_DELAY);
	});
}

/*
 * Executions still flagged as running at startup time were lost with the previous server process
 */
plugin.markInterruptedExecutions = function(){
	plugin.debug('->markInterruptedExecutions()');
	let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	datatypePlugin.query(EXECUTION_DATATYPE,{"selector": {"status": {"$eq": EXECUTION_RUNNING}}},function(err,records){
		if(err){
			plugin.error('unable to look up for interrupted Workflow executions: '+JSON.stringify(err));
		}else{
			for(var i=0;i<records.length;i++){
				let update = {
					"id": records[i].id,
					"status": EXECUTION_INTERRUPTED,
					"endedAt": moment().format(TIMESTAMP_FORMAT),
					"message": "Execution interrupted by a server restart"
				};
				datatypePlugin.updateRecord(EXECUTION_DATATYPE,update,function(err,data){
					if(err){
						plugin.error('unable to update interrupted Workflow execution: '+JSON.stringify(err));
					}
				});
			}
			if(records.length>0){
				plugin.info(records.length+' Workflow execution(s) flagged as interrupted');
			}
		}
		plugin.debug('<-markInterruptedExecutions()');
	});
}

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
    this.trace('->lazzyPlug('+extenderId+','+extensionPointConfig.point+')');
    if('apaf.workflow.node.provider'==extensionPointConfig.point){
		this.info('plugin-in contribution "'+extensionPointConfig.name+'" from '+extenderId);
        this.debug('contribution: '+JSON.stringify(extensionPointConfig));
		let contributorPlugin = this.runtime.getPlugin(extenderId);
		let contributedNodeSrc = contributorPlugin.getResourceContent(extensionPointConfig.resourcePath);
		let nodeFragment = {"name": extensionPointConfig.name,"version": contributorPlugin.config.version,"source": contributedNodeSrc};
		this.nodeExtensions.push(nodeFragment);
		this.info('there are currently '+this.nodeExtensions.length+' custom workflow node extension(s) registered');
    }
    this.trace('<-lazzyPlug()');
}

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
			then(plugin.nodeExtensions);
		}else{
			let allFragments = plugin.nodeExtensions.concat(fragments);
			plugin.debug('<-loadCustomNodeFragments() - success');
			then(allFragments);
		}
	});
}

plugin.getCustomeNodesHandler = function(req,res){
	plugin.debug('->executeWorkflowHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workflow.get.custom.nodes.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-executeWorkflowHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			plugin.loadCustomNodeFragments(function(customNodeFragments){
				plugin.debug('<-executeWorkflowHandler() - success');
				res.json({"status": 200,"message": "ok","data": customNodeFragments});
			});
		}
	});
}

plugin.executeWorkflowHandler = function(req,res){
	plugin.debug('->executeWorkflowHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workflow.execute.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
    let propService = plugin.getService(RUNTIME_PROPERTIES_SERVICE_NAME);
    let timeout = propService.getProperty(GLOBAL_TIMEOUT_PROPERTY);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-executeWorkflowHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let workflowId = req.params.id;
			let runtimeContext = req.body;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(WORKFLOW_DATATYPE,{"id": workflowId},function(err,workflow){
				if(err){
					plugin.debug('<-executeWorkflowHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('execution requested for Workflow "'+workflow.name+'" v'+workflow.version);
					let doLogging = true;
					if(typeof runtimeContext['_options']!='undefined'){
						if(runtimeContext['_options'].noTimeout){
							timeout = 0;
						}
						if(runtimeContext['_options'].noLogging){
							doLogging = false;
						}
					}
					let engine = new WorkflowEngine(plugin,user,{"global.timeout": timeout,"logEnabled": doLogging});
					plugin.loadCustomNodeFragments(function(fragments){
						for(var i=0;i<fragments.length;i++){
							engine.registerCustomNode(fragments[i]);
						}
						engine.setEventListener(function(event){
							/*if(doLogging){
								runtimeContext['_console'].push(event);
							}*/
							if('stop'==event.type){
								plugin.debug('<-executeWorkflowHandler()');
								delete engine.runtimeContext._engine;
								res.json({"status": 200,"message": "executed","data": engine.runtimeContext});
							}
							if('debug'==event.type && doLogging){
								plugin.debug(event.source+' '+event.data);
							}
							if('warning'==event.type && doLogging){
								plugin.info(event.source+' '+event.data);
							}
							if('log'==event.type && doLogging){
								runtimeContext['_console'].push(event);
								plugin.info(event.source+' '+event.data);
							}
							if('error'==event.type){
								runtimeContext['_console'].push(event);
								plugin.error(event.source+' '+event.data);
							}
						});
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

/*
 * Asynchronous server-side execution requested from the UI: the response is sent as soon as the execution
 * record is created (status "running"); the final context is persisted in the record when the engine stops
 */
plugin.runWorkflowHandler = function(req,res){
	plugin.debug('->runWorkflowHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workflow.run.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-runWorkflowHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let workflowId = req.params.id;
			let runtimeContext = typeof req.body=='undefined'?{}:req.body;
			if(typeof runtimeContext!='object' || runtimeContext==null || Array.isArray(runtimeContext)){
				plugin.debug('<-runWorkflowHandler() - invalid context');
				res.json({"status": 400,"message": "the execution context must be a JSON object","data": []});
				return;
			}
			if(typeof runtimeContext.status=='undefined'){
				runtimeContext.status = 'pending';
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(WORKFLOW_DATATYPE,{"id": workflowId},function(err,workflow){
				if(err){
					plugin.debug('<-runWorkflowHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(!workflow){
						plugin.debug('<-runWorkflowHandler() - unknown workflow');
						res.json({"status": 404,"message": "unknown workflow","data": []});
					}else{
						if(!workflow.serverSide){
							plugin.debug('<-runWorkflowHandler() - not a server-side workflow');
							res.json({"status": 400,"message": "this workflow is not designed for server-side execution","data": []});
						}else{
							let execution = {
								"workflowId": workflow.id,
								"workflowName": workflow.name,
								"workflowVersion": workflow.version,
								"startedBy": user.login,
								"startedAt": moment().format(TIMESTAMP_FORMAT),
								"endedAt": "",
								"status": EXECUTION_RUNNING,
								"inputContext": toPlainObject(runtimeContext)
							};
							datatypePlugin.createRecord(EXECUTION_DATATYPE,execution,function(err,created){
								if(err){
									plugin.debug('<-runWorkflowHandler()');
									res.json({"status": 500,"message": err,"data": []});
								}else{
									plugin.debug('<-runWorkflowHandler() - execution started');
									res.json({"status": 200,"message": "started","data": created});
									plugin.startExecution(workflow,user,runtimeContext,created);
								}
							});
						}
					}
				}
			});
		}
	});
}

plugin.startExecution = function(workflow,owner,runtimeContext,execution){
	plugin.debug('->startExecution() execution #'+execution.id);
	let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	let propService = plugin.getService(RUNTIME_PROPERTIES_SERVICE_NAME);
	let timeout = propService.getProperty(GLOBAL_TIMEOUT_PROPERTY);
	let doLogging = workflow.loggingEnabled==true;
	if(workflow.timeoutEnabled==false){
		timeout = 0;
	}
	let options = runtimeContext['_options'];
	if(typeof options=='object' && options!=null){
		if(options.noTimeout){
			timeout = 0;
		}
		if(typeof options.noLogging!='undefined'){
			doLogging = !options.noLogging;
		}
	}
	let startTime = Date.now();
	let errorCount = 0;
	let finished = false;
	let engine = new WorkflowEngine(plugin,owner,{"global.timeout": timeout,"logEnabled": doLogging});
	let finish = function(message){
		if(finished){
			return;
		}
		finished = true;
		delete runtimeContext._engine;
		let result = toPlainObject(runtimeContext);
		let consoleEvents = Array.isArray(result['_console'])?result['_console']:[];
		delete result['_console'];
		let update = {
			"id": execution.id,
			"status": (errorCount>0 || result.status=='failure')?EXECUTION_FAILED:EXECUTION_COMPLETED,
			"contextStatus": result.status,
			"endedAt": moment().format(TIMESTAMP_FORMAT),
			"durationMs": Date.now()-startTime,
			"message": message,
			"result": result,
			"console": consoleEvents
		};
		datatypePlugin.updateRecord(EXECUTION_DATATYPE,update,function(err,data){
			if(err){
				plugin.error('unable to save the result of Workflow execution #'+execution.id+': '+JSON.stringify(err));
			}
			plugin.debug('<-startExecution() execution #'+execution.id+' is now '+update.status);
		});
	}
	plugin.loadCustomNodeFragments(function(fragments){
		for(var i=0;i<fragments.length;i++){
			engine.registerCustomNode(fragments[i]);
		}
		runtimeContext['_console'] = [];
		engine.setEventListener(function(event){
			if('stop'==event.type){
				finish(event.data);
			}
			if('debug'==event.type && doLogging){
				plugin.debug(event.source+' '+event.data);
			}
			if('warning'==event.type && doLogging){
				runtimeContext['_console'].push(event);
				plugin.info(event.source+' '+event.data);
			}
			if('log'==event.type && doLogging){
				runtimeContext['_console'].push(event);
				plugin.info(event.source+' '+event.data);
			}
			if('error'==event.type){
				errorCount++;
				runtimeContext['_console'].push(event);
				plugin.error(event.source+' '+event.data);
			}
		});
		try{
			engine.start(workflow,runtimeContext);
		}catch(startException){
			plugin.error('Workflow execution #'+execution.id+' failed to start: '+startException.message);
			errorCount++;
			finish(startException.message);
		}
	});
}

plugin.queryExecutionsHandler = function(req,res){
	plugin.debug('->queryExecutionsHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workflow.executions.query.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryExecutionsHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let query = {};
			if(typeof req.body=='object' && req.body!=null){
				query = req.body;
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(EXECUTION_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-queryExecutionsHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryExecutionsHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.deleteExecutionHandler = function(req,res){
	plugin.debug('->deleteExecutionHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workflow.executions.delete.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteExecutionHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(EXECUTION_DATATYPE,{"id": req.params.id},function(err,execution){
				if(err){
					plugin.debug('<-deleteExecutionHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(execution && EXECUTION_RUNNING==execution.status){
						plugin.debug('<-deleteExecutionHandler() - execution still running');
						res.json({"status": 409,"message": "the execution is still running","data": []});
					}else{
						datatypePlugin.deleteRecord(EXECUTION_DATATYPE,{"id": req.params.id},function(err,data){
							if(err){
								plugin.debug('<-deleteExecutionHandler()');
								res.json({"status": 500,"message": err,"data": []});
							}else{
								plugin.debug('<-deleteExecutionHandler()');
								res.json({"status": 200,"message": "deleted","data": data});
							}
						});
					}
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
	let query = {"selector": {"name": {"$eq": workflowName}}};
	if(workflowVersion!=null && workflowVersion.length>0){
		query =  {"selector": {"$and": [{"name": {"$eq": workflowName}}, {"version": {"$eq": workflowVersion}}]}};
	}
	this.queryAndExecuteWorkflow(query,owner,runtimeContext,then);
}

/*
 * queryAndExecuteWorkflow() may be called by a Servlet through plugin.executeWorkflow() or by the Scheduler Engine
 */
plugin.queryAndExecuteWorkflow = function(query,owner,runtimeContext,then){
	this.debug('->queryAndExecuteWorkflow()');
	this.trace('query: '+JSON.stringify(query));
	this.trace('owner: '+owner.login);
	this.trace('runtimeContext: '+JSON.stringify(runtimeContext));
    let propService = this.getService(RUNTIME_PROPERTIES_SERVICE_NAME);
    let timeout = propService.getProperty(GLOBAL_TIMEOUT_PROPERTY);
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
				let doLogging = true;
				if(typeof runtimeContext!='undefined' && typeof runtimeContext['_options']!='undefined'){
					if(typeof runtimeContext['_options'].noTimeout){
						timeout = 0;
					}
					if(typeof runtimeContext['_options'].noLogging){
						doLogging = false;
					}
				}else{
					if(workflow.timeoutEnabled==false){
						timeout = 0;
					}
					if(workflow.loggingEnabled==false){
						doLogging = false;
					}
				}
				plugin.debug('Executing with options:');
				plugin.debug('-timeout: '+timeout);
				plugin.debug('-doLogging: '+doLogging);
				let engine = new WorkflowEngine(plugin,owner,{"global.timeout": timeout});
				plugin.loadCustomNodeFragments(function(fragments){
					for(var i=0;i<fragments.length;i++){
						engine.registerCustomNode(fragments[i]);
					}
					engine.setEventListener(function(event){
						if(doLogging){
							runtimeContext['_console'].push(event);
						}
						if('stop'==event.type){
							plugin.debug('<-queryAndExecuteWorkflow() - stop event received');
							delete engine.runtimeContext._engine;
							then(null,engine.runtimeContext);
						}
						if('debug'==event.type && doLogging){
							plugin.debug(event.source+' '+event.data);
						}
						if('warning'==event.type && doLogging){
							plugin.info(event.source+' '+event.data);
						}
						if('log'==event.type && doLogging){
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