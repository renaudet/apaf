/*
 * manageApis.js - main javascript resource for the APAF Application Manage APIs Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const DIALOG_ID = 'simpleDialog';
const TOKEN_EDIT_FORM_ID = 'tokenEditForm';
const DATA_MANAGER_ID = 'tokenManager';
const DATATABLE_ID = 'tokenTable';

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.on('addToken',addToken);
			npaUi.on('deleteToken',deleteToken);
			npaUi.render();
		});
	});
}

addToken = function(){
	let tokenEditForm = npaUi.getComponent(TOKEN_EDIT_FORM_ID);
	tokenEditForm.setData({});
	tokenEditForm.setEditMode(true);
	let dialog = npaUi.getComponent(DIALOG_ID);
	dialog.onClose(function(){
		let tokenData = tokenEditForm.getData();
		createToken(tokenData);
	});
	dialog.open();
}

createToken = function(tokenData){
	let dataManager = npaUi.getComponent(DATA_MANAGER_ID);
	dataManager.update(tokenData).then(function(data){
		let datatable = npaUi.getComponent(DATATABLE_ID);
		datatable.refresh();
	}).onError(function(errorMsg){
		if(errorMsg.httpStatus==404){
			showError('@apaf.error.http.not.found');
		}else
			showError(errorMsg.message?errorMsg.message:errorMsg);
	});
}

deleteToken = function(event){
	let selectedToken = event.item;
	if(confirm('@apaf.page.apis.confirm.delete')){
		let dataManager = npaUi.getComponent(DATA_MANAGER_ID);
		dataManager.delete(selectedToken).then(function(data){
			let datatable = npaUi.getComponent(DATATABLE_ID);
			datatable.refresh();
			flash('@apaf.page.apis.deleted');
		}).onError(function(errorMsg){
			if(errorMsg.httpStatus==404){
				showError('@apaf.error.http.not.found');
			}else
				showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	}
}