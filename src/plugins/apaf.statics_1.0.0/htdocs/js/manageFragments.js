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
			npaUi.render();
		});
	});
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

updateVersion = function(record){
	if(record.id){
		record.version = increaseVersionNumber(record.version);
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