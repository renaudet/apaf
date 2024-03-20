/*
 * manageWorkflows.js - main javascript resource for the APAF Application Manage Workflows Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const MODAL_DIALOG_ID = 'simpleDialog';
const WORKFLOW_FORM_ID = 'workflowEditForm';
const WORKFLOW_TABLE_ID = 'workflowTable';
const WORKFLOW_DATA_MANAGER_ID = 'workflowManager';
const WORKFLOW_EDITOR_URI = '/resources/html/workflowEditor.html';

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			//npaUi.onComponentLoaded = onComponentLoaded;
			npaUi.on('addWorkflow',addWorkflow);
			npaUi.on('editRecord',editWorkflow);
			npaUi.on('editWorkflow',openWorkflowEditor);
			npaUi.on('deleteWorkflow',deleteWorkflow);
			//npaUi.registerSelectionListener(ITEM_SELECTION_LIST_ID,datatypeSelectionHandler);
			npaUi.render();
		});
	});
}

addWorkflow = function(){
	let dialog = $apaf(MODAL_DIALOG_ID);
	let form = $apaf(WORKFLOW_FORM_ID);
	let workflow = {"name": "New Workflow","version": "1.0.0","data": {"nodes": [],"connections": []}};
	let node = {"id": "Start","type": "Start", "x": 200, "y": 300, "properties": {"label": {"type": "string","name": "label","label": "Node label","override": false,"value": "Start"}}};
	workflow.data.nodes.push(node);
	node = {"id": "End","type": "End", "x": 800, "y": 300, "properties": {"label": {"type": "string","name": "label","label": "Node label","override": false,"value": "End"}}};
	workflow.data.nodes.push(node);
	form.setData(workflow);
	form.setEditMode(true);
	dialog.onClose(function(){
		if(form.isValid()){
			let newWorkflow = form.getData();
			saveWorkflow(newWorkflow,function(){
				let table = $apaf(WORKFLOW_TABLE_ID);
				table.refresh();
			});
		}
	});
	dialog.open();
}

editWorkflow = function(event){
	let workflow = event.item;
	let dialog = $apaf(MODAL_DIALOG_ID);
	let form = $apaf(WORKFLOW_FORM_ID);
	form.setData(workflow);
	form.setEditMode(true);
	dialog.onClose(function(){
		if(form.isValid()){
			let newWorkflow = form.getData();
			saveWorkflow(newWorkflow,function(){
				let table = $apaf(WORKFLOW_TABLE_ID);
				table.refresh();
			});
		}
	});
	dialog.open();
}

saveWorkflow = function(workflow,then){
	let manager = $apaf(WORKFLOW_DATA_MANAGER_ID);
	if(workflow.id){
		manager.update(workflow).then(then).onError(function(errorMsg){
			showError(errorMsg);
		});
	}else{
		manager.create(workflow).then(then).onError(function(errorMsg){
			showError(errorMsg);
		});
	}
}

deleteWorkflow = function(event){
	let workflow = event.item;
	if(confirm(apaf.localize('@apaf.workflow.table.action.delete.confirm',[workflow.name]))){
		let manager = $apaf(WORKFLOW_DATA_MANAGER_ID);
		manager.delete(workflow).then(function(){
			let table = $apaf(WORKFLOW_TABLE_ID);
			table.refresh();
		}).onError(function(errorMsg){
			showError(errorMsg);
		});
	}
}

openWorkflowEditor = function(event){
	let workflow = event.item;
	window.open(WORKFLOW_EDITOR_URI+'?workflowId='+workflow.id,'workflow_editor_'+workflow.id);
}