/*
 * workflowEditor.js - main javascript resource for the APAF Application Workflow Editor
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const WORKFLOW_DATA_MANAGER_ID = 'workflowManager';
const CARD_ID = 'workflowEditorCard';
const MODAL_DIALOG_ID = 'emptyDialog';
const JSON_DIALOG_ID = 'simpleDialog';
const JSON_EDITOR_ID = 'jsonEditor';

var xeval = eval;
var workflow = null;
var editor = null;
var engine = null;

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.onComponentLoaded = onComponentLoaded;
			npaUi.on('save',saveWorkflow);
			npaUi.on('undo',undoEditorAction);
			npaUi.on('redo',redoEditorAction);
			npaUi.on('run',executeWorkflow);
			npaUi.render();
		});
	});
}

onComponentLoaded = function(){
	let workflowId = $.urlParam('workflowId');
	if(typeof workflowId!='undefined'){
		let workflowManager = $apaf(WORKFLOW_DATA_MANAGER_ID);
		var query = {"selector": {"id": {"$eq": workflowId}}};
		workflowManager.query(query).then(function(data){
			if(data && data.length==1){
				workflow = data[0];
				setStatus('Editing: '+workflow.name+' v'+workflow.version);
				initializeEditor();
			}else{
				showError('No workflow found with ID #'+workflowId);
			}
		}).onError(function(errorMsg){
			showError(errorMsg);
		});
		
    }else{
		showError('No valid Workflow ID provided!');
	}
}

setStatus = function(txt){
	let card = $apaf(CARD_ID);
	card.setStatus(txt);
}

loadCustomNodes = function(workflowEditor,workflowEngine){
	var query = {"selector": {"type": {"$eq": "workflowNode"}}};
	makeRESTCall('POST','/apaf-dev/fragment/query',query,function(response){
		if(response.status==200){
			let fragments = response.data;
			for(var i=0;i<fragments.length;i++){
				let customWorkflowNodeFragment = fragments[i];
				try{
					xeval('var helper = {"palette":{},"engine":{}};var initializeHelper = function(){'+customWorkflowNodeFragment.source+'}');
					initializeHelper();
					if(typeof helper.palette.contribute!='undefined'){
						helper.palette.contribute(workflowEditor);
					}
					if(typeof helper.engine.addCustomNode!='undefined'){
						helper.engine.addCustomNode(workflowEngine);
					}
				}catch(evalException){
					console.log(evalException);
					showError('Exception evaluating custom Workflow node '+customWorkflowNodeFragment.name);
				}
			}
		}else{
			console.log(response);
			showWarning('@apaf.apps.page.error.loading');
		}
	},function(errorMsg){
		console.log(errorMsg);
		showWarning('@apaf.apps.page.error.loading');
	});
}

initializeEditor = function(){
	$('#editorArea').height($('#workArea').height()-35);
	editor = new GraphicalEditor('myEditor','editorArea',{"background": "#f5f3e9"});
	engine = new WorkflowEngine({"activation.delay": 1500});
	loadBuiltinNodes(editor,engine);
	loadCustomNodes(editor,engine);
	editor.setListener(new WorkflowEventListener(handlerWorkflowEvents));
	editor.saveModel = function(then){
		workflow.data = editor.serializeModel();
		workflow.version = increaseVersionNumber(workflow.version);
		let workflowManager = $apaf(WORKFLOW_DATA_MANAGER_ID);
		workflowManager.update(workflow)
		.then(function(data){
			workflow['_rev'] = data['_rev'];
			workflow.lastUpdated = data.lastUpdated;
			workflow.lastUpdatedBy = data.lastUpdatedBy;
			flash('Workflow "'+workflow.name+'" saved! New version is v'+workflow.version);
			setStatus('Editing: '+workflow.name+' v'+workflow.version);
			then();
		})
		.onError(function(errorMsg){
			showError(errorMsg);
		});
	}
	editor.init(function(){
	  if(typeof workflow.data!='undefined'){
      	editor.loadModel(workflow.data);
      }
    });
	$(window).on('resize',function(){
		$('#editorArea').height($('#workArea').height()-35);
		$('#editor').width($('#editorArea').width());
      	$('#editor').height($('#editorArea').height());
      	editor.resize();
	});
}

undoEditorAction = function(){
	editor.getCommandStack().undo();
}

redoEditorAction = function(){
	editor.getCommandStack().redo();
}

saveWorkflow = function(){
	editor.save();
}

handlerWorkflowEvents = function(event){
	console.log(event);
	if('node.selected'==event.type){
		onNodeSelected(event.source);
	}
	if('node.moved'==event.type){
		onNodeSelected(event.source);
	}
	if('edit.node'==event.type){
		openNodeEditor(event.source);
	}
}

onNodeSelected = function(node){
	setStatus('Selected Node: '+node.id+' (type: '+node.type+', location: ['+node.x+','+node.y+'])');
}

createPropertyEditor = function(property,node){
	var propertyEditorId = 'edit_'+property.name.replace(/\./g,'_');
	if(property.type=='string' || property.type=='int'){
		let html = '<input type="text" id="'+propertyEditorId+'" class="form-control form-control-sm">';
		return html;
	}
	if(property.type=='boolean'){
		let html = '<select id="'+propertyEditorId+'" class="form-control form-control-sm" style="appearance : menulist;width: 100px"><option value="true">True</option><option value="false">False</option></select>';
		return html;
	}
	if(property.type=='code'){
		let html = '<button type="button" id="'+propertyEditorId+'" class="btn btn-sm btn-primary">Edit</button>';
		return html;
	}
	if(property.type=='select'){
		let choices = property.allowedValues.split(',');
		let html = '<select id="'+propertyEditorId+'" class="form-control form-control-sm" style="appearance : menulist;">';
		for(var i=0;i<choices.length;i++){
			html += '<option>';
			html += choices[i];
			html += '</option>';
		}
		html += '</select>';
		return html;
	}
	return '<i>No Editor configured for this type yet</i>';
}

addTextInputEditorChangeHandler = function(componentId,node,property){
	$('#'+componentId).on('input.editor',function(){
		let currentVal = $(this).val();
		node.setProperty(property.name,currentVal);
	});
}

addJsonEditorChangedHandler = function(componentId,node,property){
	$('#'+componentId).on('click.editor',function(){
		let jsonEditor = $apaf(JSON_EDITOR_ID);
		jsonEditor.setText(property.value);
		jsonEditor.setReadonly(false);
		let jsonEditorDialog = $apaf(JSON_DIALOG_ID);
		jsonEditorDialog.onClose(function(){
			node.setProperty(property.name,jsonEditor.getText());
		});
		jsonEditorDialog.open();
	});
}

postCreatePropertyEditor = function(node){
	let props = node.getProperties();
	for(var i=0;i<props.length;i++){
		var property = props[i];
		var propertyEditorId = 'edit_'+property.name.replace(/\./g,'_');
		$('#'+propertyEditorId).off('.editor');
		if(property.type=='string' || property.type=='int'){
			$('#'+propertyEditorId).val(property.value);
			addTextInputEditorChangeHandler(propertyEditorId,node,property);
		}else
		if(property.type=='boolean'){
			$('#'+propertyEditorId).val(property.value?'true':'false');
		}else
		if(property.type=='code'){
			addJsonEditorChangedHandler(propertyEditorId,node,property);
		}
	}
}

createNodeEditor = function(node){
	let html = '';
	html += '<table id="data-table" class="table table-hover table-condensed">';
	html += '  <thead>';
	html += '    <tr>';
	html += '      <th>Property Name</th>';
	html += '      <th>Type</th>';
	html += '      <th>Allow<br>Context</th>';
	html += '      <th>Value</th>';
	html += '    </tr>';
	html += '  </thead>';
	html += '  <tbody>';
	let props = node.getProperties();
	for(var i=0;i<props.length;i++){
		let property = props[i];
		html += '<tr>';
		html += '  <td>'+property.label+'</td>';
		html += '  <td>'+property.type+'</td>';
		if(property.override){
			html += '  <td><span style="color: #00a000;">&checkmark;</span></td>';
		}else{
			html += '  <td><span style="color: #ff0000;">&Chi;</span></td>';
		}
		html += '  <td>'+createPropertyEditor(property,node)+'</td>';
		html += '</tr>';
	}
	html += '  </tbody>';
	html += '</table>';
	return html;
}

openNodeEditor = function(node){
	let dialog = $apaf(MODAL_DIALOG_ID);
	dialog.setTitle('Property Editor for "'+node.id+'"');
	dialog.setBody(createNodeEditor(node));
	postCreatePropertyEditor(node);
	dialog.onClose(function(){
		console.log(node);
		node.onPropertyEdited();
	});
	dialog.open();
}

openWorkflowExecutionConsole = function(){
	let dialog = $apaf(MODAL_DIALOG_ID);
	dialog.setTitle('Workflow "'+workflow.name+'" executing...');
	let html = '';
	html += '<div id="console" class="workflow-console">';
	html += '</div>';
	dialog.setBody(html);
	dialog.onClose(function(){
		
	});
	dialog.open();
}

clearConsole = function(){
	$('#console').empty();
}

log = function(level,msg){
	let timestamp = moment().format('HH:mm:ss');
	let color = '#0000ff';
	if('log'==level){
		color = '#000000';
	}
	if('error'==level){
		color = '#ff0000';
	}
	if('debug'==level){
		color = '#808080';
	}
	let html = '<div>';
	html += '<span style="color: #000000;">';
	html += timestamp;
	html += '</span>&nbsp;';
	html += '<span style="color: '+color+';">';
	html += msg;
	html += '</span></div>';
	$('#console').append(html);
	$('#console').scrollTop($('#console').prop('scrollHeight'));
}

executeWorkflow = function(){
	let consoleListener = new WorkflowEngineEventListener();
	consoleListener.setEventHandler(function(event){
		console.log('Event from WorkflowEngine:');
		console.log(event);
		log(event.type,event.source+': '+event.data);
	});
	engine.setEventListener(consoleListener);
	openWorkflowExecutionConsole();
	clearConsole();
	engine.start(workflow,{});
}