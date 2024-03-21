/*
 * workflowEngine.js - javascript support library for APAF Workflow execution
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
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
	getProperty(propertyName){
		let prop = this.workflowNode.properties[propertyName];
		if(typeof prop!='undefined'){
			if(prop.override){
				if(typeof this.engine.runtimeContext[this.id()]!='undefined' && this.engine.runtimeContext[this.id()][propertyName]!='undefined'){
					return this.engine.runtimeContext[this.id()][propertyName];
				}else{
					return prop.value;
				}
			}else{
				return prop.value;
			}
		}else{
			return undefined;
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
	nodeTypes = {};
	eventListener = new WorkflowEngineEventListener();
	workflowWrappers = {};
	links = {};
	nodeActivationEnabled = false;
	options = null;
	startNode = null;
	constructor(options={}){
		this.options = options;
	}
	registerNodeType(type,runtimeHandler){
		if(typeof this.nodeTypes[type]!='undefined'){
			throw new Error('Node type "'+type+'" is already defined - duplication detected!');
		}else{
			this.nodeTypes[type] = runtimeHandler;
		}
	}
	setEventListener(listener){
		this.eventListener = listener;
	}
	loadNodes(workflow){
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
	}
	loadLinks(workflow){
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
	}
	loadWorkflow(workflow){
		this.loadNodes(workflow);
		this.loadLinks(workflow);
	}
	start(workflow,runtimeContext){
		this.startNode = null;
		this.workflowWrappers = {};
		this.links = {};
		this.nodeActivationEnabled = true;
		this.runtimeContext = runtimeContext;
		this.fireEvent('start.requested','engine','Workflow name is "'+workflow.name+'"');
		this.loadWorkflow(workflow);
		if(this.startNode!=null){
			this.fireEvent('debug','engine','activating node #'+this.startNode.id());
			this.startNode.handler(this.startNode,'dummy',runtimeContext);
		}else{
			this.fireEvent('error','engine','no Start node found');
			this.stop('Workflow stopped unexpectedly');
		}
	}
	stop(msg){
		this.fireEvent('stop','engine',msg);
		this.nodeActivationEnabled = false;
	}
	fireEvent(type,source,data){
		if(this.nodeActivationEnabled){
			this.eventListener.handleEvent({"type": type,"source": source,"data": data});
		}
	}
	activateLink(sourceNodeId,terminalName,context){
		if(this.nodeActivationEnabled){
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
				this.fireEvent('error','engine','activation requested for unknown terminal "'+terminalId+'"');
				this.stop('Workflow stopped unexpectedly');
			}
		}
	}
}