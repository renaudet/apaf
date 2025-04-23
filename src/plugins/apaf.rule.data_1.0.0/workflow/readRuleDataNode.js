const NODE_TYPE = 'RuleData';
const PLUGIN_ID = 'apaf.rule.data';

helper.palette.contribute = function(editor){
  var loader = new ImageLoader();
  loader.addImage('backgroundIcon','/resources/img/workflows/mediumNodeIcon.png');
  loader.addImage('paletteIcon','/ruleData/img/readRuleDataNode.png');
  loader.addImage('foregroundIcon','/ruleData/img/readRuleDataIcon.png');
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
      node.addProperty('ruleName','RuleData name','string',true,'MyRule');
      node.addProperty('valuesVariableName','Values variable name','string',true,'myRuleValues');
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
			let ruleName = node.getProperty('ruleName');
			let valuesVariableName = node.getProperty('valuesVariableName');
			if(typeof engine.plugin!='undefined'){
				// executes server-side
				let plugin = executionContext._engine.getPlugin(PLUGIN_ID);
				plugin.getRuleByName(ruleName,function(err,ruleData){
					if(err){
						node.log('Error caught loading RuleData "'+ruleName+'": '+err);
						node.fire('error',executionContext);
					}else{
						node.log('RuleData "'+ruleName+'" values loading completed!');
						executionContext[valuesVariableName] = ruleData.values;
						node.fire('then',executionContext);
					}
				});
			}else{
				// executes on Browser
				let url = '/apaf-rule-data/rule/'+ruleName;
				apaf.call({
					"method": "POST",
					"uri": url,
					"payload": {}
				}).then(function(ruleData){
					node.log('RuleData "'+ruleName+'" values loading completed!');
					executionContext[valuesVariableName] = ruleData.values;
					node.fire('then',executionContext);
				}).onError(function(errorMsg){
					node.log('Error caught loading RuleData "'+ruleName+'": '+errorMsg);
					node.fire('error',executionContext);
				});
			}
		}else{
			node.error('Invalid input terminal "'+inputTerminalName+'" for '+NODE_TYPE+' node #'+node.id());
		}
	}
	engine.registerNodeType(NODE_TYPE,nodeHandler);
}