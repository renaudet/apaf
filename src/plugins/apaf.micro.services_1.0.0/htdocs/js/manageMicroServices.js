/*
 * manageMicroServices.js - main javascript resource for the APAF Manage Micro-Services page
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const EDIT_FORM_ID        = 'editForm';
const JSON_EDITOR_ID      = 'jsonEditor';
const ITEM_SELECTION_LIST_ID = 'itemSelectionList';
const DATA_MANAGER_ID     = 'microServiceManager';
const EDITING_TOOLBAR_ID  = 'editingToolbar';
const EMPTY_DIALOG_ID     = 'emptyDialog';

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.on('insert',initNewRecord);
			npaUi.on('edit',editRecord);
			npaUi.on('save',saveRecord);
			npaUi.on('delete',deleteRecord);
			npaUi.on('saveJson',saveJson);
			npaUi.on('openApiDocWizard',openApiDocWizard);
			npaUi.render();
		});
	});
}

editRecord = function(){
	let form = npaUi.getComponent(EDIT_FORM_ID);
	form.setEditMode(true);
	let toolbar = npaUi.getComponent(EDITING_TOOLBAR_ID);
	toolbar.setEnabled('edit',false);
	toolbar.setEnabled('save',true);
	toolbar.setEnabled('delete',false);
	registerFormChangeListener(form);
}

initNewRecord = function(){
	let selectList = npaUi.getComponent(ITEM_SELECTION_LIST_ID);
	selectList.select(-1);
	let record = {};
	record.name = 'NewMicroService';
	record.version = '1.0';
	record.method = 'GET';
	record.description = 'Micro-service description';
	record.enabled = false;
	record.source = 'function process(req, resp) {\n  resp.result = null;\n}';
	record.apiDoc = buildApiDoc(record);
	let form = npaUi.getComponent(EDIT_FORM_ID);
	form.setData(record);
	form.setEditMode(true);
	registerFormChangeListener(form);
}

saveRecord = function(){
	let form = npaUi.getComponent(EDIT_FORM_ID);
	if(form.isValid()){
		let updatedRecord = form.getData();
		let dataManager = npaUi.getComponent(DATA_MANAGER_ID);
		dataManager.update(updatedRecord).then(function(data){
			let editor = npaUi.getComponent(JSON_EDITOR_ID);
			editor.onItemSelected(data);
			editor.setReadonly(true);
			editor.setEnabled('saveJson',false);
			editor.setEnabled('editJson',true);
			form.setData(data);
			form.setEditMode(false);
			let toolbar = npaUi.getComponent(EDITING_TOOLBAR_ID);
			toolbar.setEnabled('edit',true);
			toolbar.setEnabled('save',false);
			toolbar.setEnabled('delete',true);
			let selectList = npaUi.getComponent(ITEM_SELECTION_LIST_ID);
			selectList.refresh();
		}).onError(function(errorMsg){
			if(errorMsg.httpStatus==404){
				showError('@apaf.error.http.not.found');
			}else{
				showError(errorMsg.message?errorMsg.message:errorMsg);
			}
		});
	}
}

saveJson = function(){
	let editor = npaUi.getComponent(JSON_EDITOR_ID);
	try{
		let updatedRecord = JSON.parse(editor.getText());
		let dataManager = npaUi.getComponent(DATA_MANAGER_ID);
		dataManager.update(updatedRecord).then(function(data){
			editor.setText(JSON.stringify(data,null,'\t'));
			let form = npaUi.getComponent(EDIT_FORM_ID);
			form.setData(data);
			form.setEditMode(false);
			let toolbar = npaUi.getComponent(EDITING_TOOLBAR_ID);
			toolbar.setEnabled('edit',true);
			toolbar.setEnabled('save',false);
			toolbar.setEnabled('delete',true);
			let selectList = npaUi.getComponent(ITEM_SELECTION_LIST_ID);
			selectList.refresh();
		}).onError(function(errorMsg){
			if(errorMsg.httpStatus==404){
				showError('@apaf.error.http.not.found');
			}else{
				showError(errorMsg.message?errorMsg.message:errorMsg);
			}
		});
	}catch(parseException){
		console.log(parseException);
		showError('@apaf.json.editor.content.invalid');
	}
}

deleteRecord = function(){
	let form = npaUi.getComponent(EDIT_FORM_ID);
	let currentRecord = form.getData();
	if(confirm(npaUi.getLocalizedString('@apaf.micro.services.delete.confirm',[currentRecord.name]))){
		let dataManager = npaUi.getComponent(DATA_MANAGER_ID);
		dataManager.delete(currentRecord).then(function(data){
			let editor = npaUi.getComponent(JSON_EDITOR_ID);
			editor.onItemSelected(null);
			let selectList = npaUi.getComponent(ITEM_SELECTION_LIST_ID);
			selectList.select(-1);
			selectList.refresh();
			form.setEditMode(false);
			form.setData({});
			let toolbar = npaUi.getComponent(EDITING_TOOLBAR_ID);
			toolbar.setEnabled('edit',false);
			toolbar.setEnabled('save',false);
			toolbar.setEnabled('delete',false);
			flash('@apaf.micro.services.delete.flash');
		}).onError(function(errorMsg){
			if(errorMsg.httpStatus==404){
				showError('@apaf.error.http.not.found');
			}else{
				showError(errorMsg.message?errorMsg.message:errorMsg);
			}
		});
	}
}

/*
 * openApiDocWizard — opens the apiDoc wizard modal and populates it from
 * the current value of the apiDoc CodeMirror editor (if any).
 */
openApiDocWizard = function(event){
	var form = npaUi.getComponent(EDIT_FORM_ID);
	var editor = form.getEditor('apiDoc');

	$('#apiDocWizardModalLabel').html(npaUi.getLocalizedString('@apaf.micro.services.apiDoc.wizard.title'));
	$('#apiDocLabelOperationId').html(npaUi.getLocalizedString('@apaf.micro.services.apiDoc.wizard.operationId')+' <span class="text-danger">*</span>');
	$('#apiDocLabelSummary').html(npaUi.getLocalizedString('@apaf.micro.services.apiDoc.wizard.summary'));
	$('#apiDocLabelDescription').html(npaUi.getLocalizedString('@apaf.micro.services.apiDoc.wizard.description')+' <span class="text-danger">*</span>');
	$('#apiDocLabelParams').html(npaUi.getLocalizedString('@apaf.micro.services.apiDoc.wizard.params'));
	$('#apiDocAddParam').html(npaUi.getLocalizedString('@apaf.micro.services.apiDoc.wizard.addParam'));
	$('#apiDocWizardApply').html(npaUi.getLocalizedString('@apaf.micro.services.apiDoc.wizard.apply'));
	$('#apiDocWizardCancel').html(npaUi.getLocalizedString('@apaf.micro.services.apiDoc.wizard.cancel'));
	$('#apiDocThName').html(npaUi.getLocalizedString('@apaf.micro.services.name'));
	$('#apiDocThType').html(npaUi.getLocalizedString('@apaf.micro.services.apiDoc.wizard.type'));
	$('#apiDocThRequired').html(npaUi.getLocalizedString('@apaf.micro.services.enabled'));
	$('#apiDocThDescription').html(npaUi.getLocalizedString('@apaf.micro.services.description'));

	var existingDoc = null;
	try{
		var raw = editor.getValue();
		if(raw && raw.trim().length>0){ existingDoc = JSON.parse(raw); }
	}catch(e){}

	$('#apiDocOperationId').val('');
	$('#apiDocSummary').val('');
	$('#apiDocDescription').val('');
	$('#apiDocParamRows').empty();

	if(existingDoc){
		try{
			var path   = Object.keys(existingDoc.paths)[0];
			var method = Object.keys(existingDoc.paths[path])[0];
			var op     = existingDoc.paths[path][method];
			$('#apiDocOperationId').val(op.operationId||'');
			$('#apiDocSummary').val(op.summary||'');
			$('#apiDocDescription').val(op.description||'');
			if(op.requestBody){
				var schema   = op.requestBody.content['application/json'].schema;
				var required = schema.required||[];
				$.each(schema.properties||{},function(paramName,paramDef){
					apiDocAddParamRow(paramName,paramDef.type||'string',required.indexOf(paramName)>=0,paramDef.description||'');
				});
			}
		}catch(e){}
	}

	var modal = new bootstrap.Modal(document.getElementById('apiDocWizardModal'));
	modal.show();

	$('#apiDocAddParam').off('.msWizard').on('click.msWizard',function(){
		apiDocAddParamRow('','string',false,'');
	});

	$('#apiDocWizardApply').off('.msWizard').on('click.msWizard',function(){
		var operationId = $('#apiDocOperationId').val().trim();
		var summary     = $('#apiDocSummary').val().trim();
		var description = $('#apiDocDescription').val().trim();
		if(!operationId||!description){
			showError('@apaf.micro.services.apiDoc.wizard.required.error');
			return;
		}
		var properties = {};
		var required = [];
		$('#apiDocParamRows tr').each(function(){
			var name       = $(this).find('.param-name').val().trim();
			var type       = $(this).find('.param-type').val();
			var isRequired = $(this).find('.param-required').is(':checked');
			var desc       = $(this).find('.param-desc').val().trim();
			if(name){
				properties[name] = {type: type};
				if(desc) properties[name].description = desc;
				if(isRequired) required.push(name);
			}
		});
		var requestBody = null;
		if(Object.keys(properties).length>0){
			var schema = {type:'object',properties:properties};
			if(required.length>0) schema.required = required;
			requestBody = {required:true,content:{'application/json':{schema:schema}}};
		}
		var operation = {operationId: operationId};
		if(summary) operation.summary = summary;
		operation.description = description;
		if(requestBody) operation.requestBody = requestBody;
		var apiDoc = {
			openapi: '3.1.0',
			info: {title: summary||operationId,version:'1.0.0'},
			paths: {'/apaf-micro-services-api/run': {post: operation}}
		};
		editor.setValue(JSON.stringify(apiDoc,null,'\t'));
		modal.hide();
	});
}

/*
 * buildApiDoc — generate an OpenAPI 3.1.0 descriptor from the record fields.
 * Preserves existing parameters if the current apiDoc already has some.
 */
buildApiDoc = function(record, existingApiDoc){
	var path    = '/apaf-micro-services-api/api/' + encodeURIComponent(record.name||'') + '/' + encodeURIComponent(record.version||'');
	var method  = (record.method||'GET').toLowerCase();
	var title   = record.name || 'NewMicroService';
	var version = record.version || '1.0';
	var desc    = record.description || '';
	var operation = { operationId: record.name||'newMicroService', description: desc };
	if(desc) operation.summary = desc;
	// preserve requestBody from existing apiDoc if present
	if(existingApiDoc){
		try{
			var existingPath   = Object.keys(existingApiDoc.paths)[0];
			var existingMethod = Object.keys(existingApiDoc.paths[existingPath])[0];
			var existingOp     = existingApiDoc.paths[existingPath][existingMethod];
			if(existingOp.requestBody) operation.requestBody = existingOp.requestBody;
		}catch(e){}
	}
	var pathObj = {};
	pathObj[method] = operation;
	var apiDoc = { openapi: '3.1.0', info: { title: title, version: version }, paths: {} };
	apiDoc.paths[path] = pathObj;
	return apiDoc;
}

/*
 * registerFormChangeListener — listen for changes on name, version, description and
 * method fields to keep the apiDoc in sync automatically.
 * Safe to call multiple times: unregisters any previous listener first.
 */
var _formChangeListener = null;
registerFormChangeListener = function(form){
	if(_formChangeListener){
		// remove previous listener to avoid duplicates
		var listeners = form.formEventListeners;
		if(listeners){
			var idx = listeners.indexOf(_formChangeListener);
			if(idx >= 0) listeners.splice(idx, 1);
		}
	}
	_formChangeListener = {
		onFormEvent: function(event){
			if(event.type !== 'change') return;
			if(event.source !== 'name' && event.source !== 'version' && event.source !== 'description' && event.source !== 'method') return;
			var record = form.getData();
			if(!record.name || !record.version) return;
			var apiDocEditor = form.getEditor('apiDoc');
			var existingApiDoc = null;
			try{
				var raw = apiDocEditor ? apiDocEditor.getValue() : null;
				if(raw && raw.trim().length > 0) existingApiDoc = JSON.parse(raw);
			}catch(e){}
			var newApiDoc = buildApiDoc(record, existingApiDoc);
			if(apiDocEditor) apiDocEditor.setValue(JSON.stringify(newApiDoc, null, '\t'));
		}
	};
	form.registerEventListener(_formChangeListener);
}

apiDocAddParamRow = function(name,type,required,description){
	var types = ['string','integer','number','boolean','array','object'];
	var typeOptions = types.map(function(t){
		return '<option value="'+t+'"'+(t===type?' selected':'')+'>'+t+'</option>';
	}).join('');
	var row = '<tr>';
	row += '<td><input type="text" class="form-control form-control-sm param-name" value="'+name+'"></td>';
	row += '<td><select class="form-select form-select-sm param-type">'+typeOptions+'</select></td>';
	row += '<td class="text-center"><input type="checkbox" class="form-check-input param-required"'+(required?' checked':'')+' ></td>';
	row += '<td><input type="text" class="form-control form-control-sm param-desc" value="'+description+'"></td>';
	row += '<td><button type="button" class="btn btn-sm btn-danger param-delete">&#10005;</button></td>';
	row += '</tr>';
	var $row = $(row);
	$row.find('.param-delete').on('click',function(){ $row.remove(); });
	$('#apiDocParamRows').append($row);
}
