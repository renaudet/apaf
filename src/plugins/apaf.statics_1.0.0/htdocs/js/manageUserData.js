/*
 * manageUserData.js - main javascript resource for the APAF Application Manage User Data Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const EDIT_FORM_ID = 'editForm';
const ITEM_SELECTION_LIST_ID = 'itemSelectionList';
const GENERIC_DATA_MANAGER_ID = 'genericManager';
const EDITING_TOOLBAR_ID = 'editingToolbar';
const EMPTY_DIALOG_ID = 'emptyDialog';
const DATATABLE_AREA_ID = 'dataTablePlaceholder';

const baseGenericDataManagerConfig = {
	"query": {
		"type": "local",
		"uri": "/user-data/datatype/query",
		"payload": {"selector": {}},
		"method": "POST",
        "adapter": "@.data"
	},
	"create": {
		"type": "local",
		"uri": "/user-data/datatype",
		"method": "POST",
		"payload": "@",
        "adapter": "@.data"
	},
	"update": {
		"type": "local",
		"uri": "/user-data/datatype",
		"method": "PUT",
		"payload": "@",
        "adapter": "@.data"
	},
	"delete": {
		"type": "local",
		"uri": "/user-data/datatype/@.id",
		"method": "DELETE",
		"payload": "{}",
        "adapter": "@.data"
	},
	"findByPrimaryKey": {
		"type": "local",
		"uri": "/user-data/datatype/@.id",
		"method": "GET",
		"payload": "{}",
        "adapter": "@.data"
	}
}

var selectedDatatype = null;

var datatypeSelectionHandler = {
	onItemSelected: function(datatype){
		selectedDatatype = datatype;
		console.log('selected Datatype:');
		console.log(datatype);
		updateDataManagerConfiguration();
		createCustomDatatable();
	}
}

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.on('add',addRecord);
			npaUi.on('editRecord',editRecord);
			npaUi.on('deleteRecord',deleteRecord);
			npaUi.on('editAsJSON',editRecordAsJSON);
			npaUi.on('filter',filterData);
			npaUi.registerSelectionListener(ITEM_SELECTION_LIST_ID,datatypeSelectionHandler);
			npaUi.render();
		});
	});
}

createDatamanagerConfig = function(){
	let config = JSON.parse(JSON.stringify(baseGenericDataManagerConfig));
	config.query.uri = config.query.uri.replace(/datatype/g,selectedDatatype.name);
	config.create.uri = config.create.uri.replace(/datatype/g,selectedDatatype.name);
	config.update.uri = config.update.uri.replace(/datatype/g,selectedDatatype.name);
	config.delete.uri = config.delete.uri.replace(/datatype/g,selectedDatatype.name);
	config.findByPrimaryKey.uri = config.findByPrimaryKey.uri.replace(/datatype/g,selectedDatatype.name);
	return config;
}

updateDataManagerConfiguration = function(){
	let manager = npaUi.getComponent(GENERIC_DATA_MANAGER_ID);
	manager.setConfiguration(createDatamanagerConfig());
}

createCustomDatatable = function(){
	$('#'+DATATABLE_AREA_ID).empty();
	let html = '';
	html += '<div id="'+selectedDatatype.name+'_table"></div>';
	$('#'+DATATABLE_AREA_ID).html(html);
	let datatableId = selectedDatatype.name+'_tmpTable';
	let maxHeight = $('#workArea').height()-50;
	let datatableConfig = {"id": datatableId,"version": "1.0.0","type": "Datatable","configuration": {"maxHeight": maxHeight,"columns": []}};
	datatableConfig.configuration.datasource = {
		"type": "managed",
		"manager": "genericManager"
	};
	let fields = sortOn(selectedDatatype.fields,'displayIndex');
	for(var i=0;i<fields.length && i<10;i++){
		let field = fields[i];
		let column = {"label": field.label,"field": field.name};
		if(typeof field.type!='undefined'){
			column.type = field.type;
		}
		if(typeof field.renderer!='undefined'){
			column.renderer = field.renderer;
		}
		datatableConfig.configuration.columns.push(column);
	}
	let actionColumn = {"label": "Actions","type": "rowActions","actions": []};
	actionColumn.actions.push({"label": "@apaf.page.user.data.table.generic.edit.label","actionId": "editRecord","icon": "/uiTools/img/silk/page_edit.png"});
	actionColumn.actions.push({"label": "@apaf.page.user.data.table.json.edit.label","actionId": "editAsJSON","icon": "/uiTools/img/silk/page_white_code_red.png"});
	actionColumn.actions.push({"label": "@apaf.page.user.data.table.generic.delete.label","actionId": "deleteRecord","icon": "/uiTools/img/silk/page_delete.png"});
	datatableConfig.configuration.columns.push(actionColumn);
	npaUi.renderSingleComponent(selectedDatatype.name+'_table',datatableConfig,function(){
		//then();
	});
}

refreshUserDataTable = function(){
	let datatableId = selectedDatatype.name+'_tmpTable';
	let datatable = npaUi.getComponent(datatableId);
	datatable.refresh();
}

addRecord = function(){
	let dialog = npaUi.getComponent(EMPTY_DIALOG_ID);
	let dialogTitle = npaUi.getLocalizedString('@apaf.page.user.data.empty.dialog.title',[selectedDatatype.label]);
	dialog.setTitle(dialogTitle);
	let html = '';
	html += '<div id="'+selectedDatatype.name+'_form"></div>';
	dialog.setBody(html);
	let formId = selectedDatatype.name+'_tmpForm';
	let formConfig = {"id": formId,"version": "1.0.0","type": "Form","configuration": {"class": "form-frame-noborder"}};
	formConfig.configuration.fields = selectedDatatype.fields;
	npaUi.renderSingleComponent(selectedDatatype.name+'_form',formConfig,function(){
		let form = npaUi.getComponent(formId);
		form.setData({});
		form.setEditMode(true);
		dialog.open();
	});
	
	dialog.onClose(function(){
		let form = npaUi.getComponent(formId);
		if(form.isValid()){
			let record = form.getData();
			console.log(record);
			let manager = npaUi.getComponent(GENERIC_DATA_MANAGER_ID);
			manager.create(record).then(function(data){
				console.log(data);
				refreshUserDataTable();
			}).onError(function(errorMsg){
				if(errorMsg.httpStatus==404){
					showError('@apaf.error.http.not.found');
				}else
					showError(errorMsg.message?errorMsg.message:errorMsg);
			});
			return true;
		}else{
			console.log('returning false');
			return false;
		}
	});
}

editRecord = function(event){
	let dialog = npaUi.getComponent(EMPTY_DIALOG_ID);
	let dialogTitle = npaUi.getLocalizedString('@apaf.page.user.data.edit.dialog.title',[selectedDatatype.label]);
	dialog.setTitle(dialogTitle);
	let html = '';
	html += '<div id="'+selectedDatatype.name+'_form"></div>';
	dialog.setBody(html);
	let formId = selectedDatatype.name+'_tmpForm';
	let formConfig = {"id": formId,"version": "1.0.0","type": "Form","configuration": {"class": "form-frame-noborder"}};
	formConfig.configuration.fields = selectedDatatype.fields;
	npaUi.renderSingleComponent(selectedDatatype.name+'_form',formConfig,function(){
		let form = $apaf(formId);
		form.setData(event.item);
		form.setEditMode(true);
		dialog.open();
	});
	dialog.onClose(function(){
		let form = $apaf(formId);
		let record = form.getData();
		console.log(record);
		let manager = npaUi.getComponent(GENERIC_DATA_MANAGER_ID);
		manager.update(record).then(function(data){
			console.log(data);
			refreshUserDataTable();
		}).onError(function(errorMsg){
			if(errorMsg.httpStatus==404){
				showError('@apaf.error.http.not.found');
			}else
				showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	});
}

editRecordAsJSON = function(event){
	let dialog = npaUi.getComponent(EMPTY_DIALOG_ID);
	let dialogTitle = npaUi.getLocalizedString('@apaf.page.user.data.edit.dialog.title',[selectedDatatype.label]);
	dialog.setTitle(dialogTitle);
	let html = '';
	html += '<div id="'+selectedDatatype.name+'_form"></div>';
	dialog.setBody(html);
	npaUi.renderSingleComponent(selectedDatatype.name+'_form',npaUi.globalConfig.components['jsonEditor'],function(){
		let editor = $apaf('jsonEditor');
		editor.setText(JSON.stringify(event.item,null,'\t'));
		editor.setReadonly(false);
		dialog.open();
	});
	dialog.onClose(function(){
		let editor = $apaf('jsonEditor');
		try{
			let record = JSON.parse(editor.getText());
			console.log(record);
			let manager = $apaf(GENERIC_DATA_MANAGER_ID);
			manager.update(record).then(function(data){
				console.log(data);
				refreshUserDataTable();
			}).onError(function(errorMsg){
				if(errorMsg.httpStatus==404){
					showError('@apaf.error.http.not.found');
				}else
					showError(errorMsg.message?errorMsg.message:errorMsg);
			});
			return true;
		}catch(pe){
			flash('Bad JSON syntax in editor!');
			return false;
		}
	});
}

deleteRecord = function(event){
	console.log(event);	
	if(confirm(npaUi.getLocalizedString('@apaf.page.user.data.table.action.delete.confirm'))){
		let manager = npaUi.getComponent(GENERIC_DATA_MANAGER_ID);
		manager.delete(event.item).then(function(){
			refreshUserDataTable();
		}).onError(function(errorMsg){
			if(errorMsg.httpStatus==404){
				showError('@apaf.error.http.not.found');
			}else
				showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	}
}

filterData = function(event){
	let filterExpr = event.data;
	let datatable = $apaf(selectedDatatype.name+'_tmpTable');
	datatable.applyFilter(filterExpr);
}