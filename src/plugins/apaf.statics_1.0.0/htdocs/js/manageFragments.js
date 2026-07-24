/*
 * manageFragments.js - main javascript resource for the APAF Application Manage Fragments Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const EDIT_FORM_ID = 'editForm';
const JSON_EDITOR_ID = 'jsonEditor';
const ITEM_SELECTION_LIST_ID = 'itemSelectionList';
const DATA_MANAGER_ID = 'fragmentManager';
const EDITING_TOOLBAR_ID = 'editingToolbar';
const EMPTY_DIALOG_ID = 'emptyDialog';
const SOURCE_CODE_FIELD_NAME = 'source';

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.onComponentLoaded = onStandardComponentsLoaded;
			npaUi.on('insert',initNewRecord);
			npaUi.on('save',saveRecord);
			npaUi.on('delete',deleteRecord);
			npaUi.on('saveJson',saveJson);
			npaUi.on('openSnippetLibrary',openSnippetLibrary);
			npaUi.on('openApiDocWizard',openApiDocWizard);
			npaUi.render();
		});
	});
}

onStandardComponentsLoaded = function(){
	apaf.loadContributions('/apaf-dev/wizards');
}

updateVersion = function(record){
	if(record.id){
		record.version = increaseVersionNumber(record.version);
	}
}

initNewRecord = function(){
	let selectList = npaUi.getComponent(ITEM_SELECTION_LIST_ID);
	selectList.select(-1);
	let fragment = {};
	fragment.name = 'NewFragment';
	fragment.version = '1.0.0';
	fragment.description = 'some description here';
	fragment.type = 'library';
	fragment.source = '// some source code here';
	let form = npaUi.getComponent(EDIT_FORM_ID);
	form.setData(fragment);
	form.setEditMode(true);
}

saveRecord = function(){
	let form = npaUi.getComponent(EDIT_FORM_ID);
	if(form.isValid()){
		let updatedRecord = form.getData();
		updateVersion(updatedRecord);
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
			}else
				showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	}
}

saveJson = function(){
	let editor = npaUi.getComponent(JSON_EDITOR_ID);
	try{	
		let updatedRecord = JSON.parse(editor.getText());
		updateVersion(updatedRecord);
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
			}else
				showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	}catch(parseException){
		console.log(parseException);
		showError('@apaf.json.editor.content.invalid');
	}
}

deleteRecord = function(){
	let form = npaUi.getComponent(EDIT_FORM_ID);
	let currentRecord = form.getData();
	if(confirm(npaUi.getLocalizedString('@apaf.page.fragments.delete.confirm',[currentRecord.name]))){
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
			flash('@apaf.page.fragments.delete.flash');
		}).onError(function(errorMsg){
			if(errorMsg.httpStatus==404){
				showError('@apaf.error.http.not.found');
			}else
				showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	}
}

function insertTextAtCursor(text) {
	let form = npaUi.getComponent(EDIT_FORM_ID);
	let editor = form.getEditor(SOURCE_CODE_FIELD_NAME);
    var doc = editor.getDoc();
    var cursor = doc.getCursor();
    doc.replaceRange(text, cursor);
}

openSnippetLibrary = function(){
	let dialog = npaUi.getComponent(EMPTY_DIALOG_ID);
	dialog.setTitle('APAF Snippet Library');
	let html = '';
	html += '<div>';
	html += '  <select id="snippetSelector" class="form-control form-control-sm">';
	html += '    <option value="">-- Please, select --</option>';
	html += '  </select>';
	html += '</div>';
	html += '<div id="snippet" style="min-height: 400px;overflow: auto;font-family: lucida console;font-size: 0.9rem;background-color: #000000;color: #00ff00;">';
	html += '</div>';
	dialog.setBody(html);
	apaf.call({
		"method": "GET",
		"uri": "/apaf-dev/snippets",
		"payload": {}
	}).then(function(data){
		if(data && data.length>0){
			let snippets = sortOn(data,'category');
			let category = '';
			let optGroupId = null;
			for(var i=0;i<snippets.length;i++){
				let snippetEntry = snippets[i];
				if(snippetEntry.category!=category){
					category = snippetEntry.category;
					optGroupId = 'snippetCategory_'+i;
					let optGroup = '<optgroup id="'+optGroupId+'" label="'+category+'"></optgroup>';
					$('#snippetSelector').append(optGroup);
				}
				let option = '';
				option += '<option value="';
				option += snippetEntry.location;
				option += '">';
				option += snippetEntry.label;
				option += '</option>';
				//$('#snippetSelector').append(option);
				$('#'+optGroupId).append(option);
			}
		}
		dialog.open();
	}).onError(function(msg){
		showError(msg);
	});
	dialog.onClose(function(){
		let selectedSnippet = $('#snippet pre').text();
		insertTextAtCursor(selectedSnippet);
	});
	$('#snippetSelector').off('.fragment');
	$('#snippetSelector').on('click.fragment',function(){
		$('#snippet').empty();
		let selectedValue = $('#snippetSelector').val();
		if(selectedValue && selectedValue.length>0){
			$.ajax({
		        url: selectedValue,
		        dataType: 'text',
		        async: true,
		        success: function(){
				}
		    }).done(function(txt){
				$('#snippet').append('<pre>'+txt.replace(/</g,'&lt;').replace(/\t/g,'&nbsp;&nbsp;&nbsp;')+'</pre>');
			});
	    }
	});
}

checkCondition = function(pluginId,snippet,ifExists){
	apaf.call({
		"method": "POST",
		"uri": "/npa-admin/checkInstallation",
		"payload": {"pluginId": pluginId}
	}).then(function(data){
		if(data && data.length>0){
			ifExists(snippet);
		}
	}).onError(function(msg){
		showError(msg);
	});
}

/*
 * openApiDocWizard - opens the apiDoc wizard modal and populates it from
 * the current value of the apiDoc CodeMirror editor (if any).
 * On "Apply", builds the OpenAPI snippet and writes it back into the editor.
 */
openApiDocWizard = function(event){
	var form = npaUi.getComponent(EDIT_FORM_ID);
	var editor = form.getEditor('apiDoc');

	// --- Localize modal labels ---
	$('#apiDocWizardModalLabel').html(npaUi.getLocalizedString('@apaf.page.fragments.apiDoc.wizard.title'));
	$('#apiDocLabelOperationId').html(npaUi.getLocalizedString('@apaf.page.fragments.apiDoc.wizard.operationId')+' <span class="text-danger">*</span>');
	$('#apiDocLabelSummary').html(npaUi.getLocalizedString('@apaf.page.fragments.apiDoc.wizard.summary'));
	$('#apiDocLabelDescription').html(npaUi.getLocalizedString('@apaf.page.fragments.apiDoc.wizard.description')+' <span class="text-danger">*</span>');
	$('#apiDocLabelParams').html(npaUi.getLocalizedString('@apaf.page.fragments.apiDoc.wizard.params'));
	$('#apiDocAddParam').html(npaUi.getLocalizedString('@apaf.page.fragments.apiDoc.wizard.addParam'));
	$('#apiDocWizardApply').html(npaUi.getLocalizedString('@apaf.page.fragments.apiDoc.wizard.apply'));
	$('#apiDocWizardCancel').html(npaUi.getLocalizedString('@apaf.page.fragments.apiDoc.wizard.cancel'));
	$('#apiDocThName').html(npaUi.getLocalizedString('@apaf.fragment.name'));
	$('#apiDocThType').html(npaUi.getLocalizedString('@apaf.fragment.type'));
	$('#apiDocThRequired').html(npaUi.getLocalizedString('@apaf.fragment.enabled'));
	$('#apiDocThDescription').html(npaUi.getLocalizedString('@apaf.fragment.description'));

	// --- Pre-populate from existing apiDoc value ---
	var existingDoc = null;
	try {
		var raw = editor.getValue();
		if(raw && raw.trim().length > 0){
			existingDoc = JSON.parse(raw);
		}
	} catch(e){ /* ignore - editor may be empty or invalid */ }

	// Reset fields
	$('#apiDocOperationId').val('');
	$('#apiDocSummary').val('');
	$('#apiDocDescription').val('');
	$('#apiDocParamRows').empty();

	if(existingDoc){
		try {
			var path = Object.keys(existingDoc.paths)[0];
			var method = Object.keys(existingDoc.paths[path])[0];
			var op = existingDoc.paths[path][method];
			$('#apiDocOperationId').val(op.operationId || '');
			$('#apiDocSummary').val(op.summary || '');
			$('#apiDocDescription').val(op.description || '');
			// Restore parameters
			if(op.requestBody){
				var schema = op.requestBody.content['application/json'].schema;
				var required = schema.required || [];
				$.each(schema.properties || {}, function(paramName, paramDef){
					apiDocAddParamRow(paramName, paramDef.type || 'string', required.indexOf(paramName) >= 0, paramDef.description || '');
				});
			}
		} catch(e){ /* ignore malformed apiDoc */ }
	}

	var modal = new bootstrap.Modal(document.getElementById('apiDocWizardModal'));
	modal.show();

	// "Add parameter" button
	$('#apiDocAddParam').off('.apiDocWizard').on('click.apiDocWizard', function(){
		apiDocAddParamRow('', 'string', false, '');
	});

	// "Apply" button
	$('#apiDocWizardApply').off('.apiDocWizard').on('click.apiDocWizard', function(){
		var operationId = $('#apiDocOperationId').val().trim();
		var summary = $('#apiDocSummary').val().trim();
		var description = $('#apiDocDescription').val().trim();
		if(!operationId || !description){
			showError('@apaf.page.fragments.apiDoc.wizard.required.error');
			return;
		}
		// Build parameters from table rows
		var properties = {};
		var required = [];
		$('#apiDocParamRows tr').each(function(){
			var name = $(this).find('.param-name').val().trim();
			var type = $(this).find('.param-type').val();
			var isRequired = $(this).find('.param-required').is(':checked');
			var desc = $(this).find('.param-desc').val().trim();
			if(name){
				properties[name] = { type: type };
				if(desc) properties[name].description = desc;
				if(isRequired) required.push(name);
			}
		});
		// Assemble OpenAPI snippet
		var requestBody = null;
		if(Object.keys(properties).length > 0){
			var schema = { type: 'object', properties: properties };
			if(required.length > 0) schema.required = required;
			requestBody = { required: true, content: { 'application/json': { schema: schema } } };
		}
		var operation = { operationId: operationId };
		if(summary) operation.summary = summary;
		operation.description = description;
		if(requestBody) operation.requestBody = requestBody;
		var apiDoc = {
			openapi: '3.1.0',
			info: { title: summary || operationId, version: '1.0.0' },
			paths: { '/apaf-mcp-tools/invoke': { post: operation } }
		};
		// Write back into the CodeMirror editor
		editor.setValue(JSON.stringify(apiDoc, null, '\t'));
		modal.hide();
	});
}

apiDocAddParamRow = function(name, type, required, description){
	var types = ['string','integer','number','boolean','array','object'];
	var typeOptions = types.map(function(t){
		return '<option value="'+t+'"'+(t===type?' selected':'')+'>'+t+'</option>';
	}).join('');
	var row = '<tr>';
	row += '<td><input type="text" class="form-control form-control-sm param-name" value="'+name+'"></td>';
	row += '<td><select class="form-select form-select-sm param-type">'+typeOptions+'</select></td>';
	row += '<td class="text-center"><input type="checkbox" class="form-check-input param-required"'+(required?' checked':'')+' ></td>';
	row += '<td><input type="text" class="form-control form-control-sm param-desc" value="'+description+'"></td>';
	row += '<td><button type="button" class="btn btn-sm btn-danger param-delete">✕</button></td>';
	row += '</tr>';
	var $row = $(row);
	$row.find('.param-delete').on('click', function(){ $row.remove(); });
	$('#apiDocParamRows').append($row);
}
