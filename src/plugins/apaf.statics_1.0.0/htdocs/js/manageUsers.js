/*
 * manageUsers.js - main javascript resource for the APAF Application Manage Users Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const EDIT_FORM_ID = 'editForm';
const JSON_EDITOR_ID = 'jsonEditor';
const ITEM_SELECTION_LIST_ID = 'itemSelectionList';
const DATA_MANAGER_ID = 'userManager';
const EDITING_TOOLBAR_ID = 'editingToolbar';

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
			npaUi.render();
		});
	});
}

saveJson = function(){
	let editor = npaUi.getComponent(JSON_EDITOR_ID);
	try{	
		let updatedRecord = JSON.parse(editor.getText());
		updatedRecord.password = CryptoJS.MD5(updatedRecord.password).toString();
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

initNewRecord = function(){
	let selectList = npaUi.getComponent(ITEM_SELECTION_LIST_ID);
	selectList.select(-1);
	let newUser = {};
	newUser.login = 'jdoe';
	newUser.firstname = 'John';
	newUser.lastname = 'Doe';
	newUser.mail = 'john.doe@somedomain.com';
	newUser.groups = [];
	//newUser.roles = [];
	let form = npaUi.getComponent(EDIT_FORM_ID);
	form.setData(newUser);
	form.setEditMode(true);
}

editRecord = function(){
	flash('@apaf.page.users.edit.warning');
}

saveRecord = function(){
	let form = npaUi.getComponent(EDIT_FORM_ID);
	if(form.isValid()){
		let updatedRecord = form.getData();
		updatedRecord.password = CryptoJS.MD5(updatedRecord.password).toString();
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

deleteRecord = function(){
	let form = npaUi.getComponent(EDIT_FORM_ID);
	let currentRecord = form.getData();
	if(confirm(npaUi.getLocalizedString('@apaf.page.users.delete.confirm',[currentRecord.login]))){
		let dataManager = npaUi.getComponent(DATA_MANAGER_ID);
		dataManager.delete(currentRecord).then(function(data){
			let editor = npaUi.getComponent(JSON_EDITOR_ID);
			editor.onItemSelected(null);
			//editor.setReadonly(true);
			//editor.setEnabled('saveJson',false);
			//editor.setEnabled('editJson',true);
			let selectList = npaUi.getComponent(ITEM_SELECTION_LIST_ID);
			selectList.select(-1);
			selectList.refresh();
			form.setEditMode(false);
			form.setData({});
			let toolbar = npaUi.getComponent(EDITING_TOOLBAR_ID);
			toolbar.setEnabled('edit',false);
			toolbar.setEnabled('save',false);
			toolbar.setEnabled('delete',false);
			flash('@apaf.page.users.delete.flash');
		}).onError(function(errorMsg){
			if(errorMsg.httpStatus==404){
				showError('@apaf.error.http.not.found');
			}else
				showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	}
}