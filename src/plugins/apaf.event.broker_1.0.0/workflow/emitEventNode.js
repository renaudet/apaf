const NODE_TYPE = 'Emit Event';
const BROKER_SERVICE_ID = 'broker';
const CORE_PLUGIN_ID = 'npa.core';

helper.palette.contribute = function(editor){
  var loader = new ImageLoader();
  loader.addImage('backgroundIcon','/resources/img/workflows/mediumNodeIcon.png');
  loader.addImage('paletteIcon','/eventRes/img/eventEmitNode.png');
  loader.addImage('foregroundIcon','/eventRes/img/eventEmitIcon.png');
  loader.load();
  loader.onReadyState = function(){
    factory = new GraphicNodeFactory(NODE_TYPE,loader.getImage('paletteIcon'));
    factory.instanceCount = 0;
    factory.createNode = function(){
      var nodeId = NODE_TYPE+'_'+(this.instanceCount++);
      var node = new GraphicNode(nodeId,NODE_TYPE);
      node.backgroundIcon = loader.getImage('backgroundIcon');
      node.foregroundIcon = loader.getImage('foregroundIcon');
      var input01 = new GraphicNodeTerminal('input');
      var output01 = new GraphicNodeTerminal('then');
      var output02 = new GraphicNodeTerminal('error');
      node.addInputTerminal(input01);
      node.addOutputTerminal(output01);
      node.addOutputTerminal(output02);
      node.addProperty('eventName','Event name','string',true,'event');
      node.addProperty('dataVariableName','Event data variable','string',true,'eventData');
      return node;
    }
    editor.getPalette().addFactory(factory);
    factory.close();
    editor.refresh();
  }
}

helper.engine.addCustomNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'==inputTerminalName){
			let eventName = node.getProperty('eventName');
			let dataVariableName = node.getProperty('dataVariableName');
			let eventData = executionContext[dataVariableName];
			if(typeof eventData=='undefined'){
				eventData = {};
			}
			let event = {"name": eventName,"source": node.id(),"data": eventData};
			if(typeof engine.plugin!='undefined'){
				// executes server-side
				let eventBroker = executionContext._engine.getPlugin(CORE_PLUGIN_ID).getService(BROKER_SERVICE_ID);
				if(eventBroker.emit(event)){
					node.log('event "'+eventName+'" emitted!');
					node.fire('then',executionContext);
				}else{
					node.log('Error caught emitting event '+eventName);
					node.fire('error',executionContext);
				}
			}else{
				// executes on Browser
				apaf.call({
					"method": "POST",
					"uri": "/apaf-event/emit",
					"payload": event
				}).then(function(data){
					node.log('event "'+eventName+'" emitted!');
					node.fire('then',executionContext);
				}).onError(function(errorMsg){
					node.log('Error caught emitting event '+eventName);
					node.fire('error',executionContext);
				});
			}
		}else{
			node.error('Invalid input terminal "'+inputTerminalName+'" for '+NODE_TYPE+' node #'+node.id());
		}
	}
	engine.registerNodeType(NODE_TYPE,nodeHandler);
}