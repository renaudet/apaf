/*
 * manageAuditRecords.js - main javascript resource for the APAF Application Manage Audit records Page
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const ITEM_SELECTION_LIST_ID = 'itemSelectionList';
const GENERIC_DATA_MANAGER_ID = 'genericManager';
//const EDITING_TOOLBAR_ID = 'editingToolbar';
const EMPTY_DIALOG_ID = 'emptyDialog';
const DATATABLE_ID = 'auditTable';
const FILTER_FIELD_ID = 'auditRecordToolbar_filter_filter';
const DIALOG_FORM_ID = 'auditRecordForm';

let dataManagerConfig = {
	"query": {
		"type": "local",
		"uri": "/apaf-audit/query",
		"payload": {"selector": {}},
		"method": "POST",
        "adapter": "@.data"
	},
	"create": {
		"type": "local",
		"uri": "/apaf-audit",
		"method": "POST",
		"payload": "@",
        "adapter": "@.data"
	},
	"update": {
		"type": "local",
		"uri": "/apaf-audit",
		"method": "PUT",
		"payload": "@",
        "adapter": "@.data"
	},
	"delete": {
		"type": "local",
		"uri": "/apaf-audit/@.id",
		"method": "DELETE",
		"payload": "{}",
        "adapter": "@.data"
	},
	"findByPrimaryKey": {
		"type": "local",
		"uri": "/apaf-audit/@.id",
		"method": "GET",
		"payload": "{}",
        "adapter": "@.data"
	}
}

var selectedDatatype = null;

var datatypeSelectionHandler = {
	onItemSelected: function(datatype){
		selectedDatatype = datatype;
		updateDataManagerConfiguration();
		$('#'+FILTER_FIELD_ID).val('');
		refreshTable();
	}
}

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			/*npaUi.on('add',addRecord);
			npaUi.on('editRecord',showRecord);
			npaUi.on('duplicateRecord',duplicateRecord);
			npaUi.on('deleteRecord',deleteRecord);
			npaUi.on('editAsJSON',editRecordAsJSON);
			npaUi.on('import',importData);*/
			npaUi.on('deleteRecord',deleteRecord);
			npaUi.on('showRecord',showRecord);
			npaUi.on('filter',filterData);
			npaUi.registerSelectionListener(ITEM_SELECTION_LIST_ID,datatypeSelectionHandler);
			npaUi.onComponentLoaded = onComponentLoaded;
			npaUi.render();
		});
	});
}

onComponentLoaded = function(){
	let manager = npaUi.getComponent(GENERIC_DATA_MANAGER_ID);
	manager.addNotificationListener({
		onNotification: function(dataEvent){
			refresTable();
		}
	});
}

refreshTable = function(){
	console.log('refreshTable()');
	let datatable = $apaf(DATATABLE_ID);
	datatable.refresh();
}

createDatamanagerConfig = function(){
	dataManagerConfig.query.payload = {"selector": {"datatypeid": {"$eq": selectedDatatype.id}}};
	return dataManagerConfig;
}

updateDataManagerConfiguration = function(){
	console.log('updateDataManagerConfiguration()');
	let manager = npaUi.getComponent(GENERIC_DATA_MANAGER_ID);
	manager.setConfiguration(createDatamanagerConfig());
}

filterData = function(event){
	let filterExpr = event.data;
	let datatable = $apaf(DATATABLE_ID);
	datatable.applyFilter(filterExpr);
}

let dialogCount = 0;
showRecord = function(event){
	let dialog = $apaf(EMPTY_DIALOG_ID);
	let dialogTitle = npaUi.getLocalizedString('@apaf.page.audit.dialog.title',[event.item.id]);
	dialog.setTitle(dialogTitle);
	let form = $apaf(DIALOG_FORM_ID);
	let record = Object.assign({},event.item);
	let jsonData = JSON.stringify(record.data,null,'\t');
	record.data = jsonData;
	console.log(record);
	form.setData(record);
	form.setEditMode(false);
	dialog.open();
}

deleteRecord = function(event){
	if(confirm(npaUi.getLocalizedString('@apaf.page.audit.delete.confirm'))){
		let manager = npaUi.getComponent(GENERIC_DATA_MANAGER_ID);
		manager.delete(event.item).then(function(){
			refreshTable();
		}).onError(function(errorMsg){
			if(errorMsg.httpStatus==404){
				showError('@apaf.error.http.not.found');
			}else
				showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	}
}
