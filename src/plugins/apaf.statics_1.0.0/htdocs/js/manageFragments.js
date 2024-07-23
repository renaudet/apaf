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
			npaUi.on('insert',initNewRecord);
			npaUi.on('save',saveRecord);
			npaUi.on('delete',deleteRecord);
			npaUi.on('saveJson',saveJson);
			npaUi.on('openSnippetLibrary',openSnippetLibrary);
			npaUi.render();
		});
	});
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
	$.loadJson('/dev/snippets/snippetList.json',function(snippetConfig){
		for(var i=0;i<snippetConfig.length;i++){
			let snippet = snippetConfig[i];
			if(typeof snippet.ifExists=='undefined'){
				let option = '';
				option += '<option value="';
				option += snippet.location;
				option += '">';
				option += snippet.label;
				option += '</option>';
				$('#snippetSelector').append(option);
			}else{
				checkCondition(snippet.ifExists,snippet,function(snp){
					let option = '';
					option += '<option value="';
					option += snp.location;
					option += '">';
					option += snp.label;
					option += '</option>';
					$('#snippetSelector').append(option);
				});
			}
		}
		dialog.open();
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