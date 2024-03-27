/*
 * apafNodes.js - javascript convenience library for the APAF Application Workflow Editor
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
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
const DEBUG_NODE_TYPE = 'Debug';
const TRASH_NODE_TYPE = 'Trash';
const SET_PROPERTY_NODE_TYPE = 'SetProperty';
const DELAY_NODE_TYPE = 'Delay';
const DB_QUERY_NODE_TYPE = 'DB_Query';
const DB_CREATE_NODE_TYPE = 'DB_Create';
const DB_UPDATE_NODE_TYPE = 'DB_Update';
const DB_DELETE_NODE_TYPE = 'DB_Delete';
const FOR_LOOP_NODE_TYPE = 'For';
const LIBRARY_NODE_TYPE = 'Library';
const SNIPPET_NODE_TYPE = 'Snippet';
const WORKFLOW_NODE_TYPE = 'Workflow';

var zeval = eval;
 
addStartNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		node.fire('do',executionContext);
	}
	engine.registerNodeType(START_NODE_TYPE,nodeHandler);
}

addStopNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for Stop node #'+node.id());
		}else{
			executionContext.status = 'failure';
			engine.stop('Workflow immediate Stop requested due to failure',executionContext['_uid']);
		}
	}
	engine.registerNodeType(STOP_NODE_TYPE,nodeHandler);
}

addEndNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for End node #'+node.id());
		}else{
			let status = executionContext.status;
			if(typeof status!='undefined'){
				engine.stop('Workflow completed - status is '+status,executionContext['_uid']);
			}else{
				engine.stop('Workflow completed - status is '+status,executionContext['_uid']);
			}
		}
	}
	engine.registerNodeType(END_NODE_TYPE,nodeHandler);
}

addJoinNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
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
	engine.registerNodeType(JOIN_NODE_TYPE,nodeHandler);
}

addIfNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for If node #'+node.id());
		}else{
			let toEval = node.getProperty('condition');
			try{
				let booleanEvaluation = zeval(toEval);
				if(booleanEvaluation){
					node.fire('then',executionContext);
				}else{
					node.fire('else',executionContext);
				}
			}catch(t){
				node.error('Exception caught evaluating condition for If node #'+node.id());
			}
		}
	}
	engine.registerNodeType(IF_NODE_TYPE,nodeHandler);
}

addScriptNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for Script node #'+node.id());
		}else{
			let toEval = 'var handler = {}; handler.activate=function(node,ctx){'+node.getProperty('source')+'}';
			try{
				zeval(toEval);
				handler.activate(node,executionContext);
			}catch(t){
				//console.log(t);
				node.error('Exception caught evaluating script #'+node.id()+': '+t.message);
				node.fire('error',executionContext);
			}
		}
	}
	engine.registerNodeType(SCRIPT_NODE_TYPE,nodeHandler);
}

addRestCallNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for RestCall node #'+node.id());
		}else{
			let payload = executionContext[node.getProperty('payload.variable.name')];
			if(typeof payload=='undefined'){
				payload = {};
			}
			let secured = ('true'==node.getProperty('secured'));
			let callContext = {};
			callContext.method = 'POST';
			callContext.uri = '/apaf-rest/invoke';
			callContext.payload = {
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
			apaf.call(callContext)
			    .then(function(data){
					node.debug('REST call was successfull');
					executionContext[node.getProperty('response.variable.name')] = data;
					node.fire('then',executionContext);
				})
			    .onError(function(errorMsg){
					node.error('REST call failed with error '+errorMsg);
					node.fire('error',executionContext);
				});
		}
	}
	engine.registerNodeType(REST_NODE_TYPE,nodeHandler);
}

addOrNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input1'!=inputTerminalName && 'input2'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for Or node #'+node.id());
		}else{
			node.fire('then',executionContext);
		}
	}
	engine.registerNodeType(OR_NODE_TYPE,nodeHandler);
}

addForkNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for Fork node #'+node.id());
		}else{
			node.fire('then1',executionContext);
			node.fire('then2',executionContext);
		}
	}
	engine.registerNodeType(FORK_NODE_TYPE,nodeHandler);
}

addSendMailNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for SendMail node #'+node.id());
		}else{
			let content = executionContext[node.getProperty('mail.content.variable.name')];
			if(typeof content=='undefined'){
				content = {};
			}
			let contentIsText = (node.getProperty('send.as.text')=='true')
			let callContext = {};
			callContext.method = 'POST';
			callContext.uri = '/apaf-mail/send';
			callContext.payload = {
			  "from": node.getProperty('from'),
			  "to": node.getProperty('to'),
			  "subject": node.getProperty('subject'),
			  "content": content,
			  "asText": contentIsText
			}
			node.debug('sending mail to '+node.getProperty('to'));
			apaf.call(callContext)
			    .then(function(data){
					if(data.response){
						node.debug('Mail sent - response is '+data.response);
						node.fire('then',executionContext);
					}else{
						node.debug('Mail sent - status is unknown');
						node.fire('then',executionContext);
					}
				})
			    .onError(function(errorMsg){
					node.error('Mail sending failed: '+errorMsg);
					node.fire('error',executionContext);
				});
		}
	}
	engine.registerNodeType(MAIL_NODE_TYPE,nodeHandler);
}

addDebugNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for Debug node #'+node.id());
		}else{
			if(typeof executionContext[node.getProperty('debug.variable.name')]!='undefined'){
				node.debug(JSON.stringify(executionContext[node.getProperty('debug.variable.name')],null,'\t'));
			}else{
				node.debug('variable '+node.getProperty('debug.variable.name')+' not set!');
			}
			node.fire('then',executionContext);
		}
	}
	engine.registerNodeType(DEBUG_NODE_TYPE,nodeHandler);
}

addTrashNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for Trash node #'+node.id());
		}
	}
	engine.registerNodeType(TRASH_NODE_TYPE,nodeHandler);
}

addSetPropertyNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for SetProperty node #'+node.id());
		}else{
			node.debug('variable name: '+node.getProperty('variable.name'));
			node.debug('value set: '+node.getProperty('value.to.set'));
			executionContext[node.getProperty('variable.name')] = node.getProperty('value.to.set');
			node.fire('then',executionContext);
		}
	}
	engine.registerNodeType(SET_PROPERTY_NODE_TYPE,nodeHandler);
}

addDelayNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for Delay node #'+node.id());
		}else{
			setTimeout(function(){ node.fire('then',executionContext); },node.getProperty('delay'));
		}
	}
	engine.registerNodeType(DELAY_NODE_TYPE,nodeHandler);
}

addDbQueryNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
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
			let callContext = {};
			callContext.method = 'POST';
			callContext.uri = '/user-data/'+datatype+'/query';
			callContext.payload = query
			apaf.call(callContext)
			    .then(function(data){
					executionContext[resultSetVariableName] = data;
					node.fire('then',executionContext);
				})
			    .onError(function(errorMsg){
					node.error('Database query failed: '+errorMsg);
					node.fire('error',executionContext);
				});
		}
	}
	engine.registerNodeType(DB_QUERY_NODE_TYPE,nodeHandler);
}

addDbCreateNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for DB_Create node #'+node.id());
		}else{
			let datatype = node.getProperty('datatype');
			let recordVariableName = node.getProperty('record.variable.name');
			let callContext = {};
			callContext.method = 'POST';
			callContext.uri = '/user-data/'+datatype;
			callContext.payload = executionContext[recordVariableName];
			apaf.call(callContext)
			    .then(function(data){
					executionContext[recordVariableName] = data;
					node.fire('then',executionContext);
				})
			    .onError(function(errorMsg){
					node.error('Database record creation failed: '+errorMsg);
					node.fire('error',executionContext);
				});
		}
	}
	engine.registerNodeType(DB_CREATE_NODE_TYPE,nodeHandler);
}

addDbUpdateNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for DB_Update node #'+node.id());
		}else{
			let datatype = node.getProperty('datatype');
			let recordVariableName = node.getProperty('record.variable.name');
			let callContext = {};
			callContext.method = 'PUT';
			callContext.uri = '/user-data/'+datatype;
			callContext.payload = executionContext[recordVariableName];
			apaf.call(callContext)
			    .then(function(data){
					executionContext[recordVariableName] = data;
					node.fire('then',executionContext);
				})
			    .onError(function(errorMsg){
					node.error('Database record update failed: '+errorMsg);
					node.fire('error',executionContext);
				});
		}
	}
	engine.registerNodeType(DB_UPDATE_NODE_TYPE,nodeHandler);
}

addDbDeleteNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for DB_Delete node #'+node.id());
		}else{
			let datatype = node.getProperty('datatype');
			let recordIdVariableName = node.getProperty('record.id.variable.name');
			let callContext = {};
			callContext.method = 'DELETE';
			callContext.uri = '/user-data/'+datatype+'/'+executionContext[recordIdVariableName];
			apaf.call(callContext)
			    .then(function(data){
					node.fire('then',executionContext);
				})
			    .onError(function(errorMsg){
					node.error('Database record deletion failed: '+errorMsg);
					node.fire('error',executionContext);
				});
		}
	}
	engine.registerNodeType(DB_DELETE_NODE_TYPE,nodeHandler);
}

addForLoopNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
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
	engine.registerNodeType(FOR_LOOP_NODE_TYPE,nodeHandler);
}

addLoadLibraryNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for LoadLibrary node #'+node.id());
		}else{
			let libraryPath = node.getProperty('library.path');
			if(libraryPath && libraryPath.length>0){
				$.loadScript(libraryPath, function(){
					node.fire('then',executionContext);
				});
			}else{
				node.fire('then',executionContext);
			}
		}
	}
	engine.registerNodeType(LIBRARY_NODE_TYPE,nodeHandler);
}

addLoadSnippetNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for Snippet node #'+node.id());
		}else{
			let snippet = node.getProperty('snippet.name');
			if(snippet && snippet.length>0){
				let callCtx = {};
				callCtx.method = 'POST';
				callCtx.uri = '/apaf-dev/fragment/query';
				callCtx.payload = {"selector": {"name": {"$eq": snippet}}};
				apaf.call(callCtx)
				    .then(function(fragments){
						if(fragments && fragments.length>0){
							let orderedList = sortOn(fragments,'version',false);
							let lastFragmentVersion = orderedList[0];
							try{
								zeval(lastFragmentVersion.source);
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
				     })
				    .onError(function(errorMsg){
						node.error('unable to load fragment "'+snippet+'": '+errorMsg);
						node.fire('error',executionContext);
					});
			}else{
				node.fire('then',executionContext);
			}
		}
	}
	engine.registerNodeType(SNIPPET_NODE_TYPE,nodeHandler);
}

addWorkflowExecutionNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'!=inputTerminalName){
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for Workflow node #'+node.id());
		}else{
			let workflowName = node.getProperty('workflow.name');
	         let contextVarName = node.getProperty('context.variable.name');
	         let workflowCtx = executionContext[contextVarName];
	         node.debug('workflow name is "'+workflowName+'"');
	         if(typeof workflowCtx=='undefined'){
	           node.debug('workflow execution context variable "'+contextVarName+'" not found - using default context');
	           workflowCtx = {"status": "pending"};
	         }
	         apaf.executeWorkflow(workflowName,null,workflowCtx,function(err,ctx){
	           if(err){
	           	node.fire('error',executionContext);
	           }else{
	           	executionContext[contextVarName] = ctx;
	           	node.fire('output',executionContext);
	           }
	         });
		}
	}
	engine.registerNodeType(WORKFLOW_NODE_TYPE,nodeHandler);
}


loadBuiltInNodeHandlers = function(engine){
	addStartNode(engine);
    addEndNode(engine);
    addStopNode(engine);
    addIfNode(engine);
    addJoinNode(engine);
    addScriptNode(engine);
    addRestCallNode(engine);
    addOrNode(engine);
    addForkNode(engine);
    addSendMailNode(engine);
    addDebugNode(engine);
    addTrashNode(engine);
    addSetPropertyNode(engine);
    addDelayNode(engine);
    addDbQueryNode(engine);
    addDbCreateNode(engine);
    addDbUpdateNode(engine);
    addDbDeleteNode(engine);
    addForLoopNode(engine);
    addLoadLibraryNode(engine);
    addLoadSnippetNode(engine);
    addWorkflowExecutionNode(engine);
}

loadBuiltinNodes = function(editor,engine){
	var loader = new ImageLoader();
	loader.addImage('medium.node.icon','/resources/img/workflows/mediumNodeIcon.png');
	loader.addImage('small.node','/resources/img/workflows/whiteSmallNode.png');
	loader.addImage('startNodeIcon','/resources/img/workflows/nodeIcons/startNode.png');
	loader.addImage('stopNodeIcon','/resources/img/workflows/nodeIcons/stopNode.png');
	loader.addImage('endNodeIcon','/resources/img/workflows/nodeIcons/endNode.png');
	loader.addImage('ifNodeIcon','/resources/img/workflows/nodeIcons/ifNode.png');
	loader.addImage('joinNodeIcon','/resources/img/workflows/nodeIcons/joinNode.png');
	loader.addImage('scriptNodeIcon','/resources/img/workflows/nodeIcons/scriptNode.png');
	loader.addImage('restNodeIcon','/resources/img/workflows/nodeIcons/restNode.png');
	loader.addImage('orNodeIcon','/resources/img/workflows/nodeIcons/orNode.png');
	loader.addImage('forkNodeIcon','/resources/img/workflows/nodeIcons/forkNode.png');
	loader.addImage('mailNodeIcon','/resources/img/workflows/nodeIcons/mailNode.png');
	loader.addImage('debugNodeIcon','/resources/img/workflows/nodeIcons/debugIcon.png');
	loader.addImage('trashNodeIcon','/resources/img/workflows/nodeIcons/trashIcon.png');
	loader.addImage('setPropertyNodeIcon','/resources/img/workflows/nodeIcons/setPropertyNode.png');
	loader.addImage('delayNodeIcon','/resources/img/workflows/nodeIcons/delayNode.png');
	loader.addImage('dbQueryNodeIcon','/resources/img/workflows/nodeIcons/databaseQueryIcon.png');
	loader.addImage('dbCreateNodeIcon','/resources/img/workflows/nodeIcons/databaseCreateIcon.png');
	loader.addImage('dbUpdateNodeIcon','/resources/img/workflows/nodeIcons/databaseUpdateIcon.png');
	loader.addImage('dbDeleteNodeIcon','/resources/img/workflows/nodeIcons/databaseDeleteIcon.png');
	loader.addImage('forLoopNodeIcon','/resources/img/workflows/nodeIcons/forLoopNode.png');
	loader.addImage('libraryNodeIcon','/resources/img/workflows/nodeIcons/loadLibraryNode.png');
	loader.addImage('snippetNodeIcon','/resources/img/workflows/nodeIcons/snippetNode.png');
	loader.addImage('workflowNodeIcon','/resources/img/workflows/nodeIcons/workflowNode.png');
	loader.load();
	loader.onReadyState = function(){
		let factory = new GraphicNodeFactory(START_NODE_TYPE,loader.getImage('startNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'Start_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,START_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('startNodeIcon');
	      var output01 = new GraphicNodeTerminal('do');
	      node.addOutputTerminal(output01);
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(STOP_NODE_TYPE,loader.getImage('stopNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'Stop_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,STOP_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('stopNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      node.addInputTerminal(input01);
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
		
		factory = new GraphicNodeFactory(END_NODE_TYPE,loader.getImage('endNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'End_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,END_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('endNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      node.addInputTerminal(input01);
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(IF_NODE_TYPE,loader.getImage('ifNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'If_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,IF_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('ifNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then');
	      var output02 = new GraphicNodeTerminal('else');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addOutputTerminal(output02);
	      node.addProperty('condition','Condition to evaluate','code',false,'true');
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(JOIN_NODE_TYPE,loader.getImage('joinNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'Join_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,JOIN_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('joinNodeIcon');
	      var input01 = new GraphicNodeTerminal('input1');
	      var input02 = new GraphicNodeTerminal('input2');
	      var output01 = new GraphicNodeTerminal('do');
	      node.addInputTerminal(input01);
	      node.addInputTerminal(input02);
	      node.addOutputTerminal(output01);
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(SCRIPT_NODE_TYPE,loader.getImage('scriptNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'Script_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,SCRIPT_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('scriptNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then');
	      var output02 = new GraphicNodeTerminal('error');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addOutputTerminal(output02);
	      node.addProperty('source','Source code','code',false,'//your code here\n\nnode.log(\'some meaningfull text\');\nnode.fire(\'then\',ctx);');
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
		
		factory = new GraphicNodeFactory(REST_NODE_TYPE,loader.getImage('restNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'RestCall_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,REST_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('restNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then');
	      var output02 = new GraphicNodeTerminal('error');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addOutputTerminal(output02);
	      node.addProperty('hostname','Target Hostname','string',true,'127.0.0.1');
	      node.addProperty('port','Target Port','int',true,9080);
	      node.addProperty('uri','REST URI','string',true,'/doSomething');
	      node.addProperty('method','HTTP Verb','select',true,'GET','GET,PUT,POST,DELETE');
	      node.addProperty('payload.variable.name','Payload variable name','string',false,'payload');
	      node.addProperty('secured','Use HTTPS','boolean',true,false);
	      node.addProperty('username','Username','string',true,'');
	      node.addProperty('password','Password','string',true,'');
	      node.addProperty('response.variable.name','Response variable name','string',false,'restCallData');
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
		
		factory = new GraphicNodeFactory(OR_NODE_TYPE,loader.getImage('orNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'Or_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,OR_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('orNodeIcon');
	      var input01 = new GraphicNodeTerminal('input1');
	      var input02 = new GraphicNodeTerminal('input2');
	      var output01 = new GraphicNodeTerminal('then');
	      node.addInputTerminal(input01);
	      node.addInputTerminal(input02);
	      node.addOutputTerminal(output01);
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(FORK_NODE_TYPE,loader.getImage('forkNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'Fork_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,FORK_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('forkNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then1');
	      var output02 = new GraphicNodeTerminal('then2');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addOutputTerminal(output02);
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(MAIL_NODE_TYPE,loader.getImage('mailNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'Mail_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,MAIL_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('mailNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then');
	      var output02 = new GraphicNodeTerminal('error');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addOutputTerminal(output02);
	      node.addProperty('from','Mail From','string',true,'');
	      node.addProperty('to','Mail To','string',true,'');
	      node.addProperty('subject','Subject','string',true,'Put some subject here');
	      node.addProperty('send.as.text','Send as pure text','boolean',true,false);
	      node.addProperty('mail.content.variable.name','Mail content variable name','string',false,'mailContent');
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(DEBUG_NODE_TYPE,loader.getImage('debugNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'Debug_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,DEBUG_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('debugNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addProperty('debug.variable.name','Debug variable name','string',true,'toDebug');
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(TRASH_NODE_TYPE,loader.getImage('trashNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'Trash_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,TRASH_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('trashNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      node.addInputTerminal(input01);
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(SET_PROPERTY_NODE_TYPE,loader.getImage('setPropertyNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'SetProperty_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,SET_PROPERTY_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('setPropertyNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addProperty('variable.name','Context variable name','string',true,'myVar');
	      node.addProperty('value.to.set','Value to set','string',true,'someValue');
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(DELAY_NODE_TYPE,loader.getImage('delayNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'Delay'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,DELAY_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('delayNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addProperty('delay','Delay time (msec)','int',true,1000);
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(DB_QUERY_NODE_TYPE,loader.getImage('dbQueryNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'DB_Query_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,DB_QUERY_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('dbQueryNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then');
	      var output02 = new GraphicNodeTerminal('error');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addOutputTerminal(output02);
	      node.addProperty('datatype','Datatype name','string',true,'');
	      node.addProperty('query','Query expr.','string',true,'{}');
	      node.addProperty('resultset.variable.name','ResultSet variable name','string',true,'data');
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
		
		factory = new GraphicNodeFactory(DB_CREATE_NODE_TYPE,loader.getImage('dbCreateNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'DB_Create_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,DB_CREATE_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('dbCreateNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then');
	      var output02 = new GraphicNodeTerminal('error');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addOutputTerminal(output02);
	      node.addProperty('datatype','Datatype name','string',true,'');
	      node.addProperty('record.variable.name','Record variable name','string',true,'record');
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(DB_UPDATE_NODE_TYPE,loader.getImage('dbUpdateNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'DB_Update_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,DB_UPDATE_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('dbUpdateNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then');
	      var output02 = new GraphicNodeTerminal('error');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addOutputTerminal(output02);
	      node.addProperty('datatype','Datatype name','string',true,'');
	      node.addProperty('record.variable.name','Record variable name','string',true,'record');
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(DB_DELETE_NODE_TYPE,loader.getImage('dbDeleteNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'DB_Delete_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,DB_DELETE_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('dbDeleteNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then');
	      var output02 = new GraphicNodeTerminal('error');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addOutputTerminal(output02);
	      node.addProperty('datatype','Datatype name','string',true,'');
	      node.addProperty('record.id.variable.name','Record #ID variable name','string',true,'recordId');
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(FOR_LOOP_NODE_TYPE,loader.getImage('forLoopNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'For_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,FOR_LOOP_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('forLoopNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var input02 = new GraphicNodeTerminal('loopBack');
	      var output01 = new GraphicNodeTerminal('then');
	      var output02 = new GraphicNodeTerminal('do');
	      node.addInputTerminal(input01);
	      node.addInputTerminal(input02);
	      node.addOutputTerminal(output01);
	      node.addOutputTerminal(output02);
	      node.addProperty('indice.variable.name','Indice variable name','string',true,'i');
	      node.addProperty('indice.initial.value','Indice initial value','int',true,0);
	      node.addProperty('indice.max.value','Indice final value','int',true,10);
	      node.addProperty('indice.increment','Increment','int',true,1);
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(LIBRARY_NODE_TYPE,loader.getImage('libraryNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'LoadLibrary_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,LIBRARY_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('libraryNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addProperty('library.path','Library Path','string',false,'');
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
		
		factory = new GraphicNodeFactory(SNIPPET_NODE_TYPE,loader.getImage('snippetNodeIcon'));
		factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = 'Snippet_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,SNIPPET_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('snippetNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('then');
	      var output02 = new GraphicNodeTerminal('error');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addOutputTerminal(output02);
	      node.addProperty('snippet.name','Snippet Name','string',false,'');
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
	    
	    factory = new GraphicNodeFactory(WORKFLOW_NODE_TYPE,loader.getImage('workflowNodeIcon'));
	    factory.instanceCount = 0;
	    factory.createNode = function(){
	      var nodeId = WORKFLOW_NODE_TYPE+'_'+(this.instanceCount++);
	      var node = new GraphicNode(nodeId,WORKFLOW_NODE_TYPE);
	      node.backgroundIcon = loader.getImage('workflowNodeIcon');
	      var input01 = new GraphicNodeTerminal('input');
	      var output01 = new GraphicNodeTerminal('output');
	      var output02 = new GraphicNodeTerminal('error');
	      node.addInputTerminal(input01);
	      node.addOutputTerminal(output01);
	      node.addOutputTerminal(output02);
	      node.addProperty('workflow.name','Workflow name','string',false,'');
	      node.addProperty('context.variable.name','Context variable','string',true,'workflowCtx');
	      return node;
	    }
	    editor.getPalette().addFactory(factory);
	    factory.close();
	    
	    loadBuiltInNodeHandlers(engine);
	    editor.refresh();
    }
}