/*
 * workflowEngine.js - APAF Workflows Engine for server-side workflow execution
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const TIMESTAMP_FORMAT = 'HH:mm:ss';
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const WORKFLOW_PLUGIN_ID = 'apaf.workflow';
const USER_DATATYPE_DATATYPE = 'datatype';
const FRAGMENT_DATATYPE = 'fragment';
const JOB_SERVICE_NAME = 'jobs';
 
const START_NODE_TYPE = 'Start';
const STOP_NODE_TYPE = 'Stop';
const END_NODE_TYPE = 'End';
const IF_NODE_TYPE = 'If';
const JOIN_NODE_TYPE = 'Join';
const SCRIPT_NODE_TYPE = 'Script';
const REST_NODE_TYPE = 'RestCall';
const OR_NODE_TYPE = 'Or';
const FORK_NODE_TYPE = 'Fork';
const MAIL_NODE_TYPE = 'Mail';
const REST_CALL_SUPPORT_PLUGIN_ID = 'npa.rest';
const DEFAULT_MAIL_PROVIDER_ID = 'SMTP';
const MAIL_SERVICE_NAME = 'mail';
const DEBUG_NODE_TYPE = 'Debug';
const TRASH_NODE_TYPE = 'Trash';
const SET_PROPERTY_NODE_TYPE = 'SetProperty';
const DELAY_NODE_TYPE = 'Delay';
const DB_QUERY_NODE_TYPE = 'DB_Query';
const DB_CREATE_NODE_TYPE = 'DB_Create';
const DB_UPDATE_NODE_TYPE = 'DB_Update';
const DB_DELETE_NODE_TYPE = 'DB_Delete';
const FOR_LOOP_NODE_TYPE = 'For';
const SNIPPET_NODE_TYPE = 'Snippet';
const WORKFLOW_NODE_TYPE = 'Workflow';

var xeval = eval;

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
 
class WorkflowEngineEventListener{
	eventHandler = null;
	constructor(){
	}
	handleEvent(event){
		if(this.eventHandler!=null){
			try{
				this.eventHandler(event);
			}catch(e){}
		}
	}
	setEventHandler(func){
		this.eventHandler = func;
	}
}

class WorkflowNodeWrapper{
	workflowNode = null;
	engine = null;
	state = {};
	handler = null;
	constructor(node,engine){
		this.workflowNode = node;
		this.engine = engine;
	}
	id(){
		return this.workflowNode.id;
	}
	internalGetPropertyValue(propertyName){
		let rawProperty = this.workflowNode.properties[propertyName];
		if('int'==rawProperty.type){
			return parseInt(rawProperty.value, 10);
		}
		if('boolean'==rawProperty.type){
			return ('true'==rawProperty.value || rawProperty.value);
		}
		return rawProperty.value;
	}
	getProperty(propertyName){
		let prop = this.workflowNode.properties[propertyName];
		if(typeof prop!='undefined'){
			if(prop.override){
				if(typeof this.engine.runtimeContext[this.id()]!='undefined' && typeof this.engine.runtimeContext[this.id()][propertyName]!='undefined'){
					return this.engine.runtimeContext[this.id()][propertyName];
				}else{
					return this.internalGetPropertyValue(propertyName);
				}
			}else{
				return this.internalGetPropertyValue(propertyName);
			}
		}else{
			return undefined;
		}
	}
	setProgress(percent){
		if(percent && Number.isInteger(percent) && percent >=0 && percent <=100){
			let jobService = this.engine.plugin.getService(JOB_SERVICE_NAME);
			jobService.updateJob({"id": this.engine.runtimeContext._jobId,"progress": percent});
		}
	}
	log(msg){
		this.engine.fireEvent('log',this.id(),msg);
	}
	debug(msg){
		this.engine.fireEvent('debug',this.id(),msg);
	}
	error(msg){
		this.engine.fireEvent('error',this.id(),msg);
	}
	async fire(terminalName,context){
		this.engine.activateLink(this.id(),terminalName,context);
	}
	setHandler(handler){
		this.handler = handler;
	}
}
 
class WorkflowEngine{
	executionId = uuidv4();
	nodeTypes = {};
	eventListener = new WorkflowEngineEventListener();
	workflowWrappers = {};
	links = {};
	nodeActivationEnabled = false;
	options = null;
	startNode = null;
	plugin = null;
	owner = null;
	constructor(plugin,processOwner,options={}){
		this.plugin = plugin;
		this.owner = processOwner;
		this.options = options;
		this.loadBuiltInNodes();
	}
	require(dep){
		return require(dep);
	}
	loadBuiltInNodes(){
		this.debug('->WorkflowEngine#loadBuiltInNodes()');
		let plugin = this.plugin;
		let engine = this;
		let user = engine.owner;
		let nodeHandler = function(node,inputTerminalName,executionContext){
			node.fire('do',executionContext);
		}
		this.registerNodeType(START_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for Stop node #'+node.id());
			}else{
				executionContext.status = 'failure';
				engine.stop('Workflow immediate Stop requested due to failure');
			}
		}
		this.registerNodeType(STOP_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for End node #'+node.id());
			}else{
				let status = executionContext.status;
				if(typeof status!='undefined'){
					engine.stop('Workflow completed - status is '+status);
				}else{
					engine.stop('Workflow completed - status is '+status);
				}
			}
		}
		this.registerNodeType(END_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input1'!=inputTerminalName && 'input2'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for Join node #'+node.id());
			}else{
				node.state[inputTerminalName] = 'activated';
				if(node.state['input1']=='activated' && node.state['input2']=='activated'){
					delete node.state['input1'];
					delete node.state['input2'];
					node.fire('do',executionContext);
				}
			}
		}
		this.registerNodeType(JOIN_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for If node #'+node.id());
			}else{
				let toEval = 'function ifNodeEvaluation(node,ctx){ return '+node.getProperty('condition')+'; }';
				try{
					xeval(toEval);
					let booleanEvaluation = ifNodeEvaluation(node,executionContext);
					if(booleanEvaluation){
						node.fire('then',executionContext);
					}else{
						node.fire('else',executionContext);
					}
				}catch(t){
					console.log(t);
					node.error('Exception caught evaluating condition for If node #'+node.id());
				}
			}
		}
		this.registerNodeType(IF_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for Script node #'+node.id());
			}else{
				let toEval = 'var handler = {}; handler.activate=function(node,ctx){'+node.getProperty('source')+'}';
				try{
					xeval(toEval);
					handler.activate(node,executionContext);
				}catch(t){
					node.error('Exception caught evaluating script #'+node.id()+': '+t.message);
					node.fire('error',executionContext);
				}
			}
		}
		this.registerNodeType(SCRIPT_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for RestCall node #'+node.id());
			}else{
				let payload = executionContext[node.getProperty('payload.variable.name')];
				if(typeof payload=='undefined'){
					payload = {};
				}
				let secured = ('true'==node.getProperty('secured'));
				let callContext = {
				  "host": node.getProperty('hostname'),
				  "port": node.getProperty('port'),
				  "uri": node.getProperty('uri'),
				  "secured": secured,
				  "username": node.getProperty('username'),
				  "password": node.getProperty('password'),
				  "method": node.getProperty('method'),
				  "payload": payload
				}
				node.debug('performing REST call '+node.getProperty('method')+' '+node.getProperty('uri'));
				let restPlugin = plugin.runtime.getPlugin(REST_CALL_SUPPORT_PLUGIN_ID);
				if(user.isAdmin || typeof user.roles['coreServices']!='undefined'){
					restPlugin.performRestApiCall(callContext,function(err,data){
						if(err){
							node.error('REST call failed with error '+err);
							node.fire('error',executionContext);
						}else{
							node.debug('REST call was successfull');
							executionContext[node.getProperty('response.variable.name')] = data;
							node.fire('then',executionContext);
						}
					});
				}else{
					node.error('REST call failed: unauthorized');
					node.fire('error',executionContext);
				}
			}
		}
		this.registerNodeType(REST_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input1'!=inputTerminalName && 'input2'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for Or node #'+node.id());
			}else{
				node.fire('then',executionContext);
			}
		}
		this.registerNodeType(OR_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for Fork node #'+node.id());
			}else{
				node.fire('then1',executionContext);
				node.fire('then2',executionContext);
			}
		}
		this.registerNodeType(FORK_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for SendMail node #'+node.id());
			}else{
				let content = executionContext[node.getProperty('mail.content.variable.name')];
				if(typeof content=='undefined'){
					content = {};
				}
				let contentIsHtml = (node.getProperty('send.as.text')=='false')
				let callContext = {
				  "from": node.getProperty('from'),
				  "to": node.getProperty('to'),
				  "subject": node.getProperty('subject'),
				  "content": content,
				  "asHtml": contentIsHtml
				}
				node.debug('sending mail to '+node.getProperty('to'));
				let mailService = plugin.getService(MAIL_SERVICE_NAME);
				if(user.isAdmin || typeof user.roles['coreServices']!='undefined'){
					mailService.sendMail(DEFAULT_MAIL_PROVIDER_ID,callContext.from,callContext.to,callContext.subject,callContext.content,callContext.asHtml,function(err,response){
						if(err){
							node.error('Mail sending failed: '+err);
							node.fire('error',executionContext);
						}else{
							if(response.response){
								node.debug('Mail sent - response is '+response.response);
								node.fire('then',executionContext);
							}else{
								node.debug('Mail sent - status is unknown');
								node.fire('then',executionContext);
							}
						}
					});
				}else{
					node.error('Mail sending failed: unauthorized');
					node.fire('error',executionContext);
				}
			}
		}
		this.registerNodeType(MAIL_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for Debug node #'+node.id());
			}else{
				if(typeof executionContext[node.getProperty('debug.variable.name')]!='undefined'){
					node.debug(JSON.stringify(executionContext[node.getProperty('debug.variable.name')],null,'\t'));
				}
				node.fire('then',executionContext);
			}
		}
		this.registerNodeType(DEBUG_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for Trash node #'+node.id());
			}
		}
		engine.registerNodeType(TRASH_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for SetProperty node #'+node.id());
			}else{
				node.debug('variable name: '+node.getProperty('variable.name'));
				node.debug('value set: '+node.getProperty('value.to.set'));
				executionContext[node.getProperty('variable.name')] = node.getProperty('value.to.set');
				node.fire('then',executionContext);
			}
		}
		this.registerNodeType(SET_PROPERTY_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for Delay node #'+node.id());
			}else{
				setTimeout(function(){ node.fire('then',executionContext); },node.getProperty('delay'));
			}
		}
		this.registerNodeType(DELAY_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for DB_Query node #'+node.id());
			}else{
				let datatype = node.getProperty('datatype');
				let queryExpr = node.getProperty('query');
				if(typeof queryExpr=='undefined' || queryExpr==null || queryExpr.length==0){
					queryExpr = '{}';
				}
				let query = JSON.parse(queryExpr);
				let resultSetVariableName = node.getProperty('resultset.variable.name');
				let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
				datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatype}}},function(err,data){
					if(err){
						node.error('Database datatype query failed: '+err);
						node.fire('error',executionContext);
					}else{
						if(data && data.length>0){
							let datatypeRecord = data[0];
							if(user.isAdmin || datatypeRecord.readRole.length==0 || typeof user.roles[datatypeRecord.readRole]!='undefined'){
								datatypePlugin.query(datatypeRecord.name,query,function(err,data){
									if(err){
										node.error('Database query failed: '+err);
										node.fire('error',executionContext);
									}else{
										executionContext[resultSetVariableName] = data;
										node.fire('then',executionContext);
									}
								});
							}else{
								node.error('Database query failed: unauthorized');
								node.fire('error',executionContext);
							}
						}else{
							node.error('Database query failed: datatype "'+datatype+'" not found');
							node.fire('error',executionContext);
						}
					}
				});
			}
		}
		engine.registerNodeType(DB_QUERY_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for DB_Create node #'+node.id());
			}else{
				let datatype = node.getProperty('datatype');
				let recordVariableName = node.getProperty('record.variable.name');
				let record = executionContext[recordVariableName];
				let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
				datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatype}}},function(err,data){
					if(err){
						node.error('Database datatype query failed: '+err);
						node.fire('error',executionContext);
					}else{
						if(data && data.length>0){
							let datatypeRecord = data[0];
							if(user.isAdmin || datatypeRecord.writeRole.length==0 || typeof user.roles[datatypeRecord.writeRole]!='undefined'){
								datatypePlugin.createRecord(datatypeRecord.name,record,function(err,data){
									if(err){
										node.error('Database record creation failed: '+err);
										node.fire('error',executionContext);
									}else{
										executionContext[recordVariableName] = data;
										node.fire('then',executionContext);
									}
								});
							}else{
								node.error('Database record creation failed: unauthorized');
								node.fire('error',executionContext);
							}
						}else{
							node.error('Database record creation failed: datatype "'+datatype+'" not found');
							node.fire('error',executionContext);
						}
					}
				});
			}
		}
		this.registerNodeType(DB_CREATE_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for DB_Update node #'+node.id());
			}else{
				let datatype = node.getProperty('datatype');
				let recordVariableName = node.getProperty('record.variable.name');
				let record = executionContext[recordVariableName];
				let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
				datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatype}}},function(err,data){
					if(err){
						node.error('Database datatype query failed: '+err);
						node.fire('error',executionContext);
					}else{
						if(data && data.length>0){
							let datatypeRecord = data[0];
							if(user.isAdmin || datatypeRecord.writeRole.length==0 || typeof user.roles[datatypeRecord.writeRole]!='undefined'){
								datatypePlugin.updateRecord(datatypeRecord.name,record,function(err,data){
									if(err){
										node.error('Database record update failed: '+err);
										node.fire('error',executionContext);
									}else{
										executionContext[recordVariableName] = data;
										node.fire('then',executionContext);
									}
								});
							}else{
								node.error('Database record update failed: unauthorized');
								node.fire('error',executionContext);
							}
						}else{
							node.error('Database record update failed: datatype "'+datatype+'" not found');
							node.fire('error',executionContext);
						}
					}
				});
			}
		}
		this.registerNodeType(DB_UPDATE_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for DB_Delete node #'+node.id());
			}else{
				let datatype = node.getProperty('datatype');
				let recordIdVariableName = node.getProperty('record.id.variable.name');
				let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
				datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatype}}},function(err,data){
					if(err){
						node.error('Database datatype query failed: '+err);
						node.fire('error',executionContext);
					}else{
						if(data && data.length>0){
							let datatypeRecord = data[0];
							if(user.isAdmin || datatypeRecord.deleteRole.length==0 || typeof user.roles[datatypeRecord.deleteRole]!='undefined'){
								datatypePlugin.deleteRecord(datatypeRecord.name,{"id": recordIdVariableName},function(err,data){
									if(err){
										node.error('Database record deletion failed: '+err);
										node.fire('error',executionContext);
									}else{
										node.fire('then',executionContext);
									}
								});
							}else{
								node.error('Database record deletion failed: unauthorized');
								node.fire('error',executionContext);
							}
						}else{
							node.error('Database record deletion failed: datatype "'+datatype+'" not found');
							node.fire('error',executionContext);
						}
					}
				});
			}
		}
		this.registerNodeType(DB_DELETE_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName && 'loopBack'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for For_Loop node #'+node.id());
			}else{
				if('input'==inputTerminalName){
					executionContext[node.getProperty('indice.variable.name')] = node.getProperty('indice.initial.value');
					if(node.getProperty('indice.initial.value')<node.getProperty('indice.max.value')){
						node.fire('do',executionContext);
					}else{
						node.fire('then',executionContext);
					}
				}else{
					executionContext[node.getProperty('indice.variable.name')] = executionContext[node.getProperty('indice.variable.name')]+node.getProperty('indice.increment');
					let indice = executionContext[node.getProperty('indice.variable.name')];
					if(indice<node.getProperty('indice.max.value')){
						node.debug('current indice value: '+indice);
						node.fire('do',executionContext);
					}else{
						node.fire('then',executionContext);
					}
				}	
			}
		}
		this.registerNodeType(FOR_LOOP_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for Snippet node #'+node.id());
			}else{
				let snippet = node.getProperty('snippet.name');
				if(snippet && snippet.length>0){
					let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
					datatypePlugin.query(FRAGMENT_DATATYPE,{"selector": {"name": {"$eq": snippet}}},function(err,fragments){
						if(err){
							node.error('unable to load fragment "'+snippet+'": '+errorMsg);
							node.fire('error',executionContext);
						}else{
							if(fragments && fragments.length>0){
								let orderedList = sortOn(fragments,'version',false);
								let lastFragmentVersion = orderedList[0];
								try{
									xeval(lastFragmentVersion.source);
									node.debug('snippet "'+lastFragmentVersion.name+'" v'+lastFragmentVersion.version+' loaded successfully!');
									node.fire('then',executionContext);
								}catch(evalException){
									node.error('exception evaluating fragment "'+lastFragmentVersion.name+'" v'+lastFragmentVersion.version);
									node.fire('error',executionContext);
								}
							}else{
								node.error('fragment name "'+snippet+'" not found');
								node.fire('error',executionContext);
							}
						}
					});
				}else{
					node.fire('then',executionContext);
				}
			}
		}
		this.registerNodeType(SNIPPET_NODE_TYPE,nodeHandler);
		nodeHandler = function(node,inputTerminalName,executionContext){
			if('input'!=inputTerminalName){
				node.error('Invalid input terminal "'+inputTerminalName+'" activation for Snippet node #'+node.id());
			}else{
				let workflowName = node.getProperty('workflow.name');
		        let contextVarName = node.getProperty('context.variable.name');
		        let workflowCtx = executionContext[contextVarName];
		        node.debug('workflow name is "'+workflowName+'"');
		        if(typeof workflowCtx=='undefined'){
		           node.debug('workflow execution context variable "'+contextVarName+'" not found - using default context');
		           workflowCtx = {"status": "pending"};
		        }
		        let workflowPlugin = plugin.runtime.getPlugin(WORKFLOW_PLUGIN_ID);
		        workflowPlugin.executeWorkflow(workflowName,null,user,workflowCtx,function(err,ctx){
					if(err){
		           	node.fire('error',executionContext);
		           }else{
		           	executionContext[contextVarName] = ctx;
		           	node.fire('output',executionContext);
		           }
				});
			}
		}
		this.registerNodeType(WORKFLOW_NODE_TYPE,nodeHandler);
		
		this.debug('<-WorkflowEngine#loadBuiltInNodes()');
	}
	registerNodeType(type,runtimeHandler){
		this.debug('->WorkflowEngine#registerNodeType('+type+',handler)');
		if(typeof this.nodeTypes[type]!='undefined'){
			throw new Error('Node type "'+type+'" is already defined - duplication detected!');
		}else{
			this.nodeTypes[type] = runtimeHandler;
		}
		this.debug('<-WorkflowEngine#registerNodeType()');
	}
	registerCustomNode(fragment){
		this.debug('->WorkflowEngine#registerCustomNode("'+fragment.name+'" v'+fragment.version+')');
		try{
			xeval('var helper = {"palette":{},"engine":{}};var initializeHelper = function(){'+fragment.source+'}');
			this.debug('fragment evaluated successfully');
			initializeHelper();
			this.debug('helper initialized successfully');
			if(typeof helper.engine.addCustomNode!='undefined'){
				helper.engine.addCustomNode(this);
			}
		}catch(evalException){
			this.error(evalException.message);
		}
		this.debug('<-WorkflowEngine#registerCustomNode()');
	}
	getPlugin(pluginId){
		return this.plugin.runtime.getPlugin(pluginId);
	}
	setEventListener(eventListenerFunction){
		this.debug('->WorkflowEngine#setEventListener()');
		this.eventListener.setEventHandler(eventListenerFunction);
		this.debug('->WorkflowEngine#setEventListener()');
	}
	loadNodes(workflow){
		this.debug('->WorkflowEngine#loadNodes()');
		for(var i=0;i<workflow.data.nodes.length;i++){
			let node = workflow.data.nodes[i];
			if(typeof this.nodeTypes[node.type]!='undefined'){
				let wrapper = new WorkflowNodeWrapper(node,this);
				wrapper.setHandler(this.nodeTypes[node.type]);
				this.workflowWrappers[wrapper.id()] = wrapper;
				this.fireEvent('debug','engine','registering node "'+wrapper.id()+'" of type "'+node.type+'"');
				if('Start'==node.type){
					this.startNode = wrapper;
					this.fireEvent('debug','engine','Start node detected!');
				}
			}else{
				this.fireEvent('error','engine','found unsuported node type "'+node.type+'"');
				this.stop('Workflow stopped unexpectedly');
			}
		}
		this.debug('<-WorkflowEngine#loadNodes()');
	}
	loadLinks(workflow){
		this.debug('->WorkflowEngine#loadLinks()');
		for(var i=0;i<workflow.data.connections.length;i++){
			let connection = workflow.data.connections[i];
			let tokens = connection.target.split('#');
			let targetNodeId = tokens[0];
			let targetTerminal = tokens[1];
			if(typeof this.workflowWrappers[targetNodeId]!='undefined'){
				this.links[connection.source] = {"target": this.workflowWrappers[targetNodeId],"terminal": targetTerminal};
			}else{
				this.fireEvent('error','engine','found unresolved connection from "'+connection.source+'" to "'+connection.target+'"');
				this.stop('Workflow stopped unexpectedly');
			}
		}
		this.debug('<-WorkflowEngine#loadLinks()');
	}
	loadWorkflow(workflow){
		this.debug('->WorkflowEngine#loadWorkflow()');
		this.loadNodes(workflow);
		this.loadLinks(workflow);
		this.debug('<-WorkflowEngine#loadWorkflow()');
	}
	start(workflow,runtimeContext){
		this.debug('->WorkflowEngine#start("'+workflow.name+'",ctx)');
		let jobService = this.plugin.getService(JOB_SERVICE_NAME);
		let job = jobService.createJob(this.owner.login,workflow.name+' v'+workflow.version+' '+moment().format(TIMESTAMP_FORMAT));
		runtimeContext._jobId = job.id;
		this.startNode = null;
		this.workflowWrappers = {};
		this.links = {};
		this.nodeActivationEnabled = true;
		this.runtimeContext = runtimeContext;
		this.runtimeContext._engine = this;
		this.fireEvent('start.requested','engine','Workflow name is "'+workflow.name+'"');
		this.loadWorkflow(workflow);
		if(this.startNode!=null){
			this.debug('starting workflow execution process with ID#'+this.executionId);
			if(typeof this.options['global.timeout']!='undefined'){
				this.setTimeout(this.options['global.timeout']);
			}
			this.fireEvent('debug','engine','activating node #'+this.startNode.id());
			this.startNode.handler(this.startNode,'dummy',runtimeContext);
		}else{
			this.fireEvent('error','engine','no Start node found');
			this.stop('Workflow stopped unexpectedly');
		}
		this.debug('<-WorkflowEngine#start()');
		return this.executionId;
	}
	stop(msg){
		this.debug('->WorkflowEngine#stop()');
		if(this.nodeActivationEnabled){
			let jobService = this.plugin.getService(JOB_SERVICE_NAME);
			jobService.updateJob({"id": this.runtimeContext._jobId,"progress": 100});
			this.fireEvent('stop','engine',msg);
			this.nodeActivationEnabled = false;
			this.debug('workflow execution process ID#'+this.executionId+' is now stopped!');
		}
		this.debug('<-WorkflowEngine#stop()');
	}
	fireEvent(type,source,data){
		if(this.nodeActivationEnabled){
			this.eventListener.handleEvent({"type": type,"source": source,"data": data});
		}
	}
	activateLink(sourceNodeId,terminalName,context){
		this.debug('->WorkflowEngine#activateLink('+sourceNodeId+','+terminalName+',ctx)');
		let jobService = this.plugin.getService(JOB_SERVICE_NAME);
		let job = jobService.getJob(this.runtimeContext._jobId);
		if(this.nodeActivationEnabled){
			if(job.status=='ongoing'){
				let terminalId = sourceNodeId+'#'+terminalName;
				let link = this.links[terminalId];
				if(typeof link!='undefined'){
					let target = link.target;
					let targetTerminal = link.terminal;
					this.fireEvent('debug','engine','activating terminal "'+target.id()+'#'+targetTerminal+'" from "'+terminalId+'"');
					if(typeof this.options['activation.delay']!='undefined'){
						setTimeout(function(){ target.handler(target,targetTerminal,context); },this.options['activation.delay']);
					}else{
						target.handler(target,targetTerminal,context);
					}
				}else{
					this.fireEvent('warning','engine','activation requested from unbound terminal "'+terminalId+'"');
				}
			}else{
				this.stop('Workflow terminated - job status is '+job.status);
			}
		}
		this.debug('<-WorkflowEngine#activateLink()');
	}
	setTimeout(delayMsec){
		let engine = this;
		setTimeout(function(){ engine.stop('Workflow terminated - global timeout reached'); },delayMsec);
	}
	debug(txt){
		this.plugin.debug(txt);
	}
	error(txt){
		this.plugin.error(txt);
	}
}

module.exports = WorkflowEngine;