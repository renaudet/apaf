const NODE_TYPE = 'Get Runtime Prop.';
const RUNTIME_PLUGIN_ID = 'npa.runtime.props';

helper.palette.contribute = function(editor){
  var loader = new ImageLoader();
  loader.addImage('backgroundIcon','/resources/img/workflows/mediumNodeIcon.png');
  loader.addImage('paletteIcon','/runtimeProps/img/getRuntimePropertyNode.png');
  loader.addImage('foregroundIcon','/runtimeProps/img/getRuntimePropertyIcon.png');
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
      node.addProperty('variableName','Context variable name','string',true,'myProperty');
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
			let variableName = node.getProperty('variableName');
			if(typeof engine.plugin!='undefined'){
				// executes server-side
				let runtimePlugin = executionContext._engine.getPlugin(RUNTIME_PLUGIN_ID);
				let value = runtimePlugin.getProperty(propertyName);
				if(value!=undefined){
					node.log('Runtime property "'+propertyName+'" found');
					executionContext[variableName] = value;
					node.fire('then',executionContext);
				}else{
					node.log('Runtime property "'+propertyName+'" not found');
					node.fire('error',executionContext);
				}
			}else{
				// executes on Browser
				let uri = '/runtime-properties/'+propertyName;
				apaf.call({
					"method": "GET",
					"uri": uri,
					"payload": {}
				}).then(function(value){
					node.log('Runtime property "'+propertyName+'" found with value '+value);
					executionContext[variableName] = value;
					node.fire('then',executionContext);
				}).onError(function(errorMsg){
					node.log('Error getting runtime property "'+propertyName+'": '+errorMsg);
					node.fire('error',executionContext);
				});
			}
		}else{
			node.error('Invalid input terminal "'+inputTerminalName+'" for '+NODE_TYPE+' node #'+node.id());
		}
	}
	engine.registerNodeType(NODE_TYPE,nodeHandler);
}