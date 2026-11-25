/*
 * manageWorkflows.js - main javascript resource for the APAF Application Manage Workflows Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const MODAL_DIALOG_ID = 'simpleDialog';
const WORKFLOW_FORM_ID = 'workflowEditForm';
const WORKFLOW_TABLE_ID = 'workflowTable';
const WORKFLOW_DATA_MANAGER_ID = 'workflowManager';
const WORKFLOW_EDITOR_URI = '/apaf-workflow-ui/html/workflowEditor.html';
const TAB_PANE_ID = 'workflowsTabPane';
const EXECUTIONS_TAB_ID = 'executionsTab';
const EXECUTIONS_TABLE_ID = 'executionsTable';
const RUN_DIALOG_ID = 'runWorkflowDialog';
const RUN_CONTEXT_EDITOR_ID = 'runContextEditor';
const RESULT_DIALOG_ID = 'executionResultDialog';
const RESULT_EDITOR_ID = 'executionResultEditor';
const RUN_API_URI = '/apaf-workflow/run/';
const EXECUTIONS_API_URI = '/apaf-workflow/executions/';
const EXECUTIONS_POLLING_DELAY = 3000;
const DEFAULT_RUN_CONTEXT = '{\n\t"status": "pending"\n}';

var currentExecution = null;
var executionsSupportInitialized = false;

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.on('addWorkflow',addWorkflow);
			npaUi.on('editRecord',editWorkflow);
			npaUi.on('editWorkflow',openWorkflowEditor);
			npaUi.on('deleteWorkflow',deleteWorkflow);
			npaUi.on('duplicateWorkflow',duplicateWorkflow);
			npaUi.on('filter',filterData);
			npaUi.on('runWorkflow',runWorkflow);
			npaUi.on('refreshExecutions',refreshExecutions);
			npaUi.on('filterExecutions',filterExecutions);
			npaUi.onComponentLoaded = initExecutionsSupport;
			npaUi.render();
		});
	});
}

initExecutionsSupport = function(){
	// invoked after each rendering pass (the TabPane triggers delayed ones): initialize only once
	let tabPane = $apaf(TAB_PANE_ID);
	if(executionsSupportInitialized || !tabPane){
		return;
	}
	executionsSupportInitialized = true;
	tabPane.addTabEventListener(EXECUTIONS_TAB_ID,refreshExecutions);
	$(document).off('click.workflowExecutions');
	$(document).on('click.workflowExecutions','.executionAction',function(){
		let executionId = $(this).data('id');
		let actionId = $(this).data('action');
		if('viewExecution'==actionId){
			viewExecution(executionId);
		}
		if('deleteExecution'==actionId){
			deleteExecution(executionId);
		}
	});
	$(document).off('click.workflowExecutionViews');
	$(document).on('click.workflowExecutionViews','.execution-view-btn',function(){
		$('.execution-view-btn').removeClass('active');
		$(this).addClass('active');
		showExecutionView($(this).data('view'));
	});
	// executions in progress are polled while the Executions tab is displayed
	setInterval(function(){
		let table = $apaf(EXECUTIONS_TABLE_ID);
		if(table && $('#'+EXECUTIONS_TAB_ID+'_pane').hasClass('active')){
			let running = table.dataset.filter(function(record){ return 'running'==record.status; });
			if(running.length>0){
				table.refresh();
			}
		}
	},EXECUTIONS_POLLING_DELAY);
}

escapeHtml = function(value){
	return $('<div />').text(value===undefined||value===null?'':String(value)).html();
}

unescapeI18N = function(key,data=[]){
	return $('<div />').html(apaf.localize(key,data)).text();
}

runWorkflow = function(event){
	let workflow = event.item;
	if(!workflow.serverSide){
		return;
	}
	openRunDialog(workflow,DEFAULT_RUN_CONTEXT);
}

openRunDialog = function(workflow,contextText){
	let dialog = $apaf(RUN_DIALOG_ID);
	let editor = $apaf(RUN_CONTEXT_EDITOR_ID);
	dialog.setTitle(apaf.localize('@apaf.workflow.run.dialog.title',[workflow.name,workflow.version]));
	if(workflow.documentation && workflow.documentation.trim().length>0){
		$('#runDocContent').text(workflow.documentation);
	}else{
		$('#runDocContent').html(apaf.localize('@apaf.workflow.run.doc.none'));
	}
	editor.setText(contextText);
	editor.setReadonly(false);
	dialog.onClose(function(){
		let text = editor.getText();
		let context = null;
		try{
			context = JSON.parse(text);
		}catch(parseException){
			showError(parseException.message);
			return false; // veto: keep the dialog opened
		}
		if(typeof context!='object' || context===null || Array.isArray(context)){
			showError('@apaf.workflow.run.context.invalid');
			return false; // veto: keep the dialog opened
		}
		if(typeof context.status=='undefined'){
			context.status = 'pending';
		}
		sendRunRequest(workflow,context);
		return true;
	});
	dialog.open();
}

sendRunRequest = function(workflow,context){
	apaf.call({"method": "POST","uri": RUN_API_URI+workflow.id,"payload": context})
		.then(function(execution){
			flash('@apaf.workflow.run.started',[workflow.name,workflow.version]);
			document.getElementById(EXECUTIONS_TAB_ID).click();
		})
		.onError(function(errorMsg){
			showError(errorMsg);
		});
}

refreshExecutions = function(){
	let table = $apaf(EXECUTIONS_TABLE_ID);
	if(table){
		table.refresh();
	}
}

filterExecutions = function(event){
	let table = $apaf(EXECUTIONS_TABLE_ID);
	if(table){
		table.applyFilter(event.data);
	}
}

deleteExecution = function(executionId){
	let table = $apaf(EXECUTIONS_TABLE_ID);
	let execution = table.dataset.find(function(record){ return record.id==executionId; });
	if(execution && confirm(unescapeI18N('@apaf.workflow.executions.delete.confirm',[execution.workflowName,execution.startedAt]))){
		apaf.call({"method": "DELETE","uri": EXECUTIONS_API_URI+executionId})
			.then(function(){
				table.refresh();
			})
			.onError(function(errorMsg){
				showError(errorMsg);
			});
	}
}

viewExecution = function(executionId){
	// the table only holds a projection of the records: load the complete record (result, console...)
	let query = {"selector": {"id": {"$eq": executionId}}};
	apaf.call({"method": "POST","uri": EXECUTIONS_API_URI+'query',"payload": query})
		.then(function(records){
			if(records && records.length>0){
				currentExecution = records[0];
				openResultDialog();
			}else{
				showError('@apaf.workflow.executions.not.found');
			}
		})
		.onError(function(errorMsg){
			showError(errorMsg);
		});
}

openResultDialog = function(){
	let execution = currentExecution;
	let dialog = $apaf(RESULT_DIALOG_ID);
	dialog.setTitle(apaf.localize('@apaf.workflow.executions.result.dialog.title.name',[execution.workflowName,execution.workflowVersion]));
	let html = '<table class="table table-sm table-borderless mb-0"><tbody><tr>';
	html += '<td><strong>'+apaf.localize('@apaf.workflow.execution.datatype.status')+':</strong> '+escapeHtml(execution.status)+'</td>';
	html += '<td><strong>'+apaf.localize('@apaf.workflow.execution.datatype.started.by')+':</strong> '+escapeHtml(execution.startedBy)+'</td>';
	html += '<td><strong>'+apaf.localize('@apaf.workflow.execution.datatype.started.at')+':</strong> '+escapeHtml(execution.startedAt)+'</td>';
	html += '<td><strong>'+apaf.localize('@apaf.workflow.execution.datatype.ended.at')+':</strong> '+escapeHtml(execution.endedAt)+'</td>';
	html += '<td><strong>'+apaf.localize('@apaf.workflow.execution.datatype.duration')+':</strong> '+(typeof execution.durationMs=='undefined'?'':escapeHtml(execution.durationMs+' ms'))+'</td>';
	html += '</tr></tbody></table>';
	if(execution.message){
		html += '<div class="text-muted">'+escapeHtml(execution.message)+'</div>';
	}
	$('#executionSummary').html(html);
	$('.execution-view-btn').removeClass('active');
	$('.execution-view-btn[data-view="result"]').addClass('active');
	showExecutionView('result');
	dialog.open();
}

showExecutionView = function(view){
	let editor = $apaf(RESULT_EDITOR_ID);
	let content = {};
	if(currentExecution){
		if('console'==view){
			content = currentExecution.console;
		}else
		if('input'==view){
			content = currentExecution.inputContext;
		}else{
			content = currentExecution.result;
		}
	}
	if(typeof content=='undefined'){
		content = 'running'==currentExecution.status?unescapeI18N('@apaf.workflow.executions.no.result.yet'):{};
	}
	editor.setText(typeof content=='string'?content:JSON.stringify(content,null,'\t'));
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

duplicateWorkflow = function(event){
	let workflow = event.item;
	let duplicated = Object.assign({},workflow);
	duplicated.name = duplicated.name+' (copy)';
	delete duplicated.id;
	delete duplicated.rev;
	delete duplicated._id;
	delete duplicated._rev;
	saveWorkflow(duplicated,function(){
		let table = $apaf(WORKFLOW_TABLE_ID);
		table.refresh();
	});
}

openWorkflowEditor = function(event){
	let workflow = event.item;
	window.open(WORKFLOW_EDITOR_URI+'?workflowId='+workflow.id,'workflow_editor_'+workflow.id);
}

filterData = function(event){
	let filterExpr = event.data;
	let datatable = $apaf(WORKFLOW_TABLE_ID);
	datatable.applyFilter(filterExpr);
}
