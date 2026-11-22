const NODE_TYPE = 'Set Runtime Prop.';
const RUNTIME_PLUGIN_ID = 'npa.runtime.props';

helper.palette.contribute = function(editor){
  var loader = new ImageLoader();
  loader.addImage('backgroundIcon','/resources/img/workflows/mediumNodeIcon.png');
  loader.addImage('paletteIcon','/runtimeProps/img/setRuntimePropertyNode.png');
  loader.addImage('foregroundIcon','/runtimeProps/img/setRuntimePropertyIcon.png');
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
      node.addProperty('propertyName','Runtime Property Name','string',true,'myProperty');
      node.addProperty('propertyValue','Runtime Property Value','string',true,'some value...');
      node.addProperty('propertyDescription','Runtime Property Description','string',true,'This property usage...');
      node.addProperty('propertyType','Runtime Property Type','select',true,'string','string,int,boolean');
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
			let propertyName = node.getProperty('propertyName');
			let propertyValue = node.getProperty('propertyValue');
			let propertyDescription = node.getProperty('propertyDescription');
			let propertyType = node.getProperty('propertyType');
			if(typeof engine.plugin!='undefined'){
				// executes server-side
				let runtimePlugin = executionContext._engine.getPlugin(RUNTIME_PLUGIN_ID);
				if(runtimePlugin.setProperty(propertyName,propertyValue)==undefined){
					runtimePlugin.newProperty({"name": propertyName,"value": propertyValue,"description": propertyDescription,"type": propertyType});
				}
				node.log('Runtime property "'+propertyName+'" set');
				node.fire('then',executionContext);
			}else{
				// executes on Browser
				apaf.call({
					"method": "PUT",
					"uri": "/runtime-properties",
					"payload": {"name": propertyName,"value": propertyValue,"description": propertyDescription,"type": propertyType}
				}).then(function(rows){
					node.log('Runtime property "'+propertyName+'" set');
					node.fire('then',executionContext);
				}).onError(function(errorMsg){
					node.log('Error caught setting runtime property "'+propertyName+'": '+errorMsg);
					node.fire('error',executionContext);
				});
			}
		}else{
			node.error('Invalid input terminal "'+inputTerminalName+'" for '+NODE_TYPE+' node #'+node.id());
		}
	}
	engine.registerNodeType(NODE_TYPE,nodeHandler);
}