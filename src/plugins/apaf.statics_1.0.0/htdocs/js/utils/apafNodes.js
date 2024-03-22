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
				let booleanEvaluation = xeval(toEval);
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
				xeval(toEval);
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
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for If node #'+node.id());
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
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for RestCall node #'+node.id());
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
			node.error('Invalid input terminal "'+inputTerminalName+'" activation for Debug node #'+node.id());
		}else{
			node.debug('variable name: '+node.getProperty('variable.name'));
			node.debug('value set: '+node.getProperty('value.to.set'));
			executionContext[node.getProperty('variable.name')] = node.getProperty('value.to.set');
			node.fire('then',executionContext);
		}
	}
	engine.registerNodeType(SET_PROPERTY_NODE_TYPE,nodeHandler);
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
	      node.addProperty('source','Source code','code',false,'//put here some code - end with node.fire(\'then\',ctx)');
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
	    
	    loadBuiltInNodeHandlers(engine);
	    editor.refresh();
    }
}