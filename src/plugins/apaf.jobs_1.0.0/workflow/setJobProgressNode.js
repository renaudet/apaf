const NODE_TYPE = 'Job Progress';
const JOB_PLUGIN_ID = 'npa.jobs';

helper.palette.contribute = function(editor){
  var loader = new ImageLoader();
  loader.addImage('backgroundIcon','/resources/img/workflows/mediumNodeIcon.png');
  loader.addImage('paletteIcon','/jobs/img/setJobProgressNode.png');
  loader.addImage('foregroundIcon','/jobs/img/setJobProgressIcon.png');
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
      node.addProperty('progress','Job progression (%)','int',true,100);
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
			let progress = node.getProperty('progress');
			if(typeof engine.plugin!='undefined'){
				// executes server-side
				let jobPlugin = executionContext._engine.getPlugin(JOB_PLUGIN_ID);
				jobPlugin.updateJob({"id": executionContext._jobId,"progress": progress});
				node.fire('then',executionContext);
			}else{
				// not supported on Browser
				node.log('Set Job Progress Node is not supported browser-side!');
				node.fire('error',executionContext);
			}
		}else{
			node.error('Invalid input terminal "'+inputTerminalName+'" for '+NODE_TYPE+' node #'+node.id());
		}
	}
	engine.registerNodeType(NODE_TYPE,nodeHandler);
}