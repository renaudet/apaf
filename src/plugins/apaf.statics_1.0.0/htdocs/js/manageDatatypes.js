/*
 * manageDatatypes.js - main javascript resource for the APAF Application Manage Datatypes Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const EDIT_FORM_ID = 'editForm';
const FIELD_EDIT_FORM_ID = 'fieldEditForm';
const JSON_EDITOR_ID = 'jsonEditor';
const ITEM_SELECTION_LIST_ID = 'itemSelectionList';
const DATA_MANAGER_ID = 'datatypeManager';
const EDITING_TOOLBAR_ID = 'editingToolbar';
const DIALOG_ID = 'simpleDialog';
const DATATABLE_ID = 'datatypeFieldsTable';
const EMPTY_DIALOG_ID = 'emptyDialog';

var dialogNotOpenYet = true;

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.onComponentLoaded = initComponents;
			npaUi.on('insert',initNewRecord);
			npaUi.on('edit',editRecord);
			npaUi.on('save',saveRecord);
			npaUi.on('delete',deleteRecord);
			npaUi.on('saveJson',saveJson);
			npaUi.on('addField',addDatatypeField);
			npaUi.on('editField',editDatatypeField);
			npaUi.on('deleteField',deleteDatatypeField);
			npaUi.on('testForm',testForm);
			npaUi.render();
		});
	});
}

updateVersion = function(record){
	if(record.id){
		record.version = increaseVersionNumber(record.version);
	}
}

initComponents = function(){
	let datatable = npaUi.getComponent(DATATABLE_ID);
	datatable.setEditable(false);
}

initNewRecord = function(){
	let selectList = npaUi.getComponent(ITEM_SELECTION_LIST_ID);
	selectList.select(-1);
	let datatype = {};
	datatype.name = 'newDatatype';
	//datatype.version = '1.0.0';
	datatype.label = 'New Datatype';
	datatype.description = 'Some description here';
	datatype.persistent = false;
	datatype.database = '';
	datatype.fields = [];
	let form = npaUi.getComponent(EDIT_FORM_ID);
	form.setData(datatype);
	form.setEditMode(true);
	editRecord();
}

editRecord = function(){
	let datatable = npaUi.getComponent(DATATABLE_ID);
	datatable.setEditable(true);
}

saveRecord = function(){
	let form = npaUi.getComponent(EDIT_FORM_ID);
	if(form.isValid()){
		let updatedRecord = form.getData();
		//updateVersion(updatedRecord);
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
			let datatable = npaUi.getComponent(DATATABLE_ID);
			datatable.setEditable(false);
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
		//updateVersion(updatedRecord);
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
			let datatable = npaUi.getComponent(DATATABLE_ID);
			datatable.setEditable(false);
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
	if(confirm(npaUi.getLocalizedString('@apaf.page.datatypes.delete.confirm',[currentRecord.name]))){
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
			flash('@apaf.page.datatypes.delete.flash');
			let datatable = npaUi.getComponent(DATATABLE_ID);
			datatable.renderData([]);
			datatable.setEditable(false);
		}).onError(function(errorMsg){
			if(errorMsg.httpStatus==404){
				showError('@apaf.error.http.not.found');
			}else
				showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	}
}

addDatatypeField = function(){
	let dialog = npaUi.getComponent(DIALOG_ID);
	let fieldEditForm = npaUi.getComponent(FIELD_EDIT_FORM_ID);
	let newField = {};
	newField.name = 'aField';
	newField.label = 'A Field';
	newField.type = 'text';
	newField.isIdField = true;
	fieldEditForm.setData(newField);
	if(dialogNotOpenYet){
		dialog.setTitle('@apaf.page.datatypes.dialog.title');
	}
	fieldEditForm.setEditMode(true);
	dialog.onClose(function(){
		let form = npaUi.getComponent(EDIT_FORM_ID);
		let datatype = form.getData();
		datatype.fields.push(fieldEditForm.getData());
		let datatable = npaUi.getComponent(DATATABLE_ID);
		datatable.refresh();
	});
	dialog.open();
}

editDatatypeField = function(event){
	let dialog = npaUi.getComponent(DIALOG_ID);
	let fieldEditForm = npaUi.getComponent(FIELD_EDIT_FORM_ID);
	fieldEditForm.setEditMode(true);
	if(dialogNotOpenYet){
		dialogNotOpenYet = false;
		dialog.setTitle('@apaf.page.datatypes.dialog.title');
	}
	dialog.onClose(function(){
		Object.assign(event.item,fieldEditForm.getData());
		let datatable = npaUi.getComponent(DATATABLE_ID);
		datatable.refresh();
	});
	dialog.open();
}

deleteDatatypeField = function(event){
	console.log('deleteDatatypeField()');
	console.log(event);
	let field = event.item;
	if(confirm(npaUi.getLocalizedString('@apaf.page.datatypes.field.confirm.delete',[field.name]))){
		let form = npaUi.getComponent(EDIT_FORM_ID);
		let datatype = form.getData();
		let newFields = [];
		let toCompare = JSON.stringify(field);
		for(var i=0;i<datatype.fields.length;i++){
			let aField = datatype.fields[i];
			if(JSON.stringify(aField)!=toCompare){
				newFields.push(aField);
			}
		}
		datatype.fields = newFields;
		form.setData(datatype);
		let datatable = npaUi.getComponent(DATATABLE_ID);
		datatable.onItemSelected(datatype);
	}
}

testForm = function(){
	console.log('testForm()');
	let form = npaUi.getComponent(EDIT_FORM_ID);
	let datatype = form.getData();
	let sampleForm = {};
	sampleForm.id = 'sampleForm';
	sampleForm.version = '1.0.0';
	sampleForm.type = 'Form';
	sampleForm.configuration = {};
	sampleForm.configuration.title = 'Generated by APAF v1.0.0';
	sampleForm.configuration.class = 'form-frame-noborder';
	sampleForm.configuration.fields = datatype.fields;
	console.log(sampleForm);
	npaUi.registerComponentConfig('sampleForm',sampleForm);
	let dialog = npaUi.getComponent(EMPTY_DIALOG_ID);
	dialog.setTitle('@apaf.page.datatypes.empty.dialog.title');
	let html = '';
	html += '<div class="npaUi" id="sampleFormPlaceholder" data-ref="sampleForm"></div>';
	dialog.setBody(html);
	dialog.onClose(function(){});
	dialog.onCancel(function(){});
	dialog.open();
	npaUi.unLoad('sampleForm');
	npaUi.onComponentLoaded = function(){
		let sampleFormComponent = npaUi.getComponent('sampleForm');
		sampleFormComponent.setData({});
		sampleFormComponent.setEditMode(true);
		let selectList = npaUi.getComponent(ITEM_SELECTION_LIST_ID);
		selectList.select(-1);
	}
	npaUi.render();
}