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
			npaUi.on('duplicateRecord',duplicateRecord);
			npaUi.on('deleteRecord',deleteRecord);
			npaUi.on('editAsJSON',editRecordAsJSON);
			npaUi.on('filter',filterData);
			npaUi.on('import',importData);
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
			console.log('Notification listener:');
			console.log(dataEvent);
			refreshUserDataTable();
		}
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
	manager.setDatatype(selectedDatatype.name);
}

createCustomDatatable = function(){
	$('#'+DATATABLE_AREA_ID).empty();
	let html = '';
	html += '<div id="'+selectedDatatype.name+'_table"></div>';
	$('#'+DATATABLE_AREA_ID).html(html);
	let datatableId = selectedDatatype.name+'_tmpTable';
	let maxHeight = $('#workArea').height()-50;
	let datatableConfig = {"id": datatableId,"version": "1.0.0","type": "apaf.DatatableV2","configuration": {"datatype": selectedDatatype.name,"maxHeight": maxHeight,"columns": []}};
	let fields = sortOn(selectedDatatype.fields,'displayIndex');
	for(var i=0;i<fields.length && i<10;i++){
		let field = fields[i];
		let column = {"type": "field","name": field.name};
		datatableConfig.configuration.columns.push(column);
	}
	let actionColumn = {"label": "Actions","type": "action","actions": []};
	actionColumn.actions.push({"label": "@apaf.page.user.data.table.generic.edit.label","actionId": "editRecord","icon": "/uiTools/img/silk/page_edit.png"});
	actionColumn.actions.push({"label": "@apaf.page.user.data.table.generic.duplicate.label","actionId": "duplicateRecord","icon": "/uiTools/img/silk/page_copy.png"});
	actionColumn.actions.push({"label": "@apaf.page.user.data.table.json.edit.label","actionId": "editAsJSON","icon": "/uiTools/img/silk/page_white_code_red.png"});
	actionColumn.actions.push({"label": "@apaf.page.user.data.table.generic.delete.label","actionId": "deleteRecord","icon": "/uiTools/img/silk/page_delete.png"});
	datatableConfig.configuration.columns.push(actionColumn);
	npaUi.renderSingleComponent(selectedDatatype.name+'_table',datatableConfig,function(){
	});
}

refreshUserDataTable = function(){
	let datatableId = selectedDatatype.name+'_tmpTable';
	let datatable = npaUi.getComponent(datatableId);
	datatable.refresh();
}

let dialogCount = 0;

addRecord = function(){
	let dialog = npaUi.getComponent(EMPTY_DIALOG_ID);
	let dialogTitle = npaUi.getLocalizedString('@apaf.page.user.data.empty.dialog.title',[selectedDatatype.label]);
	dialog.setTitle(dialogTitle);
	let html = '';
	let divId = selectedDatatype.name+'_form_'+(dialogCount++);
	html += '<div id="'+divId+'"></div>';
	dialog.setBody(html);
	let formId = selectedDatatype.name+'_tmpForm';
	//let formConfig = {"id": formId,"version": "1.0.0","type": "Form","configuration": {"class": "form-frame-noborder"}};
	let formConfig = {"id": formId,"version": "1.0.0","type": "apaf.DatatypeForm","configuration": {"class": "form-frame-noborder","datatype": selectedDatatype.name}};
	//formConfig.configuration.fields = selectedDatatype.fields;
	npaUi.renderSingleComponent(divId,formConfig,function(){
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

duplicateRecord = function(event){
	let selectedRecord = event.item;
	let duplicatedRecord = Object.assign({},selectedRecord);
	delete duplicatedRecord.id;
	delete duplicatedRecord._id;
	delete duplicatedRecord.rev;
	delete duplicatedRecord._rev;
	for(var i=0;i<selectedDatatype.fields.length;i++){
		let field = selectedDatatype.fields[i];
		if(field.isIdField){
			if('text'==field.type || typeof field.type=='undefined'){
				duplicatedRecord[field.name] = duplicatedRecord[field.name]+' [1]';
			}
		}
	}
	let manager = npaUi.getComponent(GENERIC_DATA_MANAGER_ID);
	manager.create(duplicatedRecord).then(function(data){
		refreshUserDataTable();
	}).onError(function(errorMsg){
		if(errorMsg.httpStatus==404){
			showError('@apaf.error.http.not.found');
		}else
			showError(errorMsg.message?errorMsg.message:errorMsg);
	});
}

editRecord = function(event){
	let dialog = npaUi.getComponent(EMPTY_DIALOG_ID);
	let dialogTitle = npaUi.getLocalizedString('@apaf.page.user.data.edit.dialog.title',[selectedDatatype.label]);
	dialog.setTitle(dialogTitle);
	let html = '';
	let divId = selectedDatatype.name+'_form_'+(dialogCount++);
	html += '<div id="'+divId+'"></div>';
	dialog.setBody(html);
	let formId = selectedDatatype.name+'_form';
	//let formConfig = {"id": formId,"version": "1.0.0","type": "Form","configuration": {"class": "form-frame-noborder"}};
	let formConfig = {"id": formId,"version": "1.0.0","type": "apaf.DatatypeForm","configuration": {"class": "form-frame-noborder","datatype": selectedDatatype.name}};
	//formConfig.configuration.fields = selectedDatatype.fields;
	npaUi.renderSingleComponent(divId,formConfig,function(){
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
	let divId = selectedDatatype.name+'_form_'+(dialogCount++);
	html += '<div id="'+divId+'"></div>';
	dialog.setBody(html);
	npaUi.renderSingleComponent(divId,npaUi.globalConfig.components['jsonEditor'],function(){
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
let importCount = 0;
importData = function(){
	let dialogOption = {};
	dialogOption.title = npaUi.getLocalizedString('@apaf.page.user.data.import.action.dialog.title');
	dialogOption.size = 'XXL';
	dialogOption.buttons = [
		{"action": "cancel","label": npaUi.getLocalizedString('@apaf.page.user.data.import.action.dialog.cancel')},
		{"action": "close","label": npaUi.getLocalizedString('@apaf.page.user.data.import.action.dialog.close')}
	]
	let dialog = apaf.createModalDialog(dialogOption);
	let inputId = 'importFileInput_'+importCount;
	let outputId = 'csvContent_'+importCount;
	let btnId = 'importFileInputSubmitBtn_'+(importCount++);
	let html = '';
	html += '';
	html += '<div class="row form-row" id="importDialogForm">';
	html += '  <div class="col-2" style="font-weight: bold;text-align: right;margin-top: 5px;">';
	html += npaUi.getLocalizedString('@apaf.page.user.data.import.action.dialog.form.input.field');
	html += '  </div>';
	html += '  <div class="col-7">';
	html += '     <input class="form-control" type="file" id="'+inputId+'"/>';
	html += '  </div>';
	html += '  <div class="col-3">';
	html += '    <button id="'+btnId+'" type="button" class="btn btn-primary">'+npaUi.getLocalizedString('@apaf.page.user.data.import.action.dialog.form.input.button')+'</button>';
	html += '  </div>';
	html += '</div>';
	html += '<div id="'+outputId+'" style="margin-top: 5px;height: 400px;overflow: auto;padding: 4px;background-color: #000;color: #0f0;font-size: 0.75rem;font-family: courier;"></div>';
	html += '';
	dialog.setBody(html);
	let data = [];
	$('#'+btnId).on('click',function(){
		var file = $('#'+inputId).get(0).files[0];
		if (file) {
		  var reader = new FileReader();
	      reader.readAsText(file, "UTF-8");
	      reader.onload = function(evt) {
			console.log(file.name+' content:');
	        console.log(evt.target.result);
	        if(evt.target.result && evt.target.result.length>0){
	        	data = evt.target.result.split('\n');
				for(var i=0;i<data.length;i++){
					let line = data[i];
					$('#'+outputId).append(line);
					$('#'+outputId).append('<br>');
				}
				console.log('- '+data.length+' lines found in file');
			}
	      }
	      reader.onerror = function(evt) {
	        console.log(evt);
	        showError('Unable to read this file');
	      }
		}else{
			showWarning('No file selected');
		}
	});
	dialog.setOnCloseCallback(function(){
		mappImportedData(data);
	});
	dialog.open();
}

const MAPPING_FORM_ID = 'mappingForm';
const MAPPING_FORM = {
    "id": MAPPING_FORM_ID,
    "version": "1.0.0",
    "type": "Form",
    "configuration": {
    	"title_": "",
    	"class": "form-frame-noborder",
    	"fields": [
    		{
    			"name": "separator",
    			"label": "@apaf.page.user.data.import.action.dialog.field.separator.label",
    			"required": true,
    			"size": 1,
    			"default": ";"
    		},
    		{
    			"name": "ignoreFirst",
    			"label": "@apaf.page.user.data.import.action.dialog.field.ignore.label",
    			"type": "check",
    			"required": true,
    			"default": true
    		}
    	]
    }
}

mappImportedData = function(data){
	let dialogOption = {};
	dialogOption.title = npaUi.getLocalizedString('@apaf.page.user.data.import.action.dialog.title');
	dialogOption.size = 'XXL';
	dialogOption.buttons = [
		{"action": "cancel","label": npaUi.getLocalizedString('@apaf.page.user.data.import.action.dialog.cancel')},
		{"action": "close","label": npaUi.getLocalizedString('@apaf.page.user.data.import.action.dialog.close')}
	]
	let dialog = apaf.createModalDialog(dialogOption);
	let html = '';
	html += '<div id="mappingDialogBody">';
	html += '<span style="padding-left: 15px;">'+npaUi.getLocalizedString('@apaf.page.user.data.import.action.dialog.line1',[data.length])+'</span>';
	html += '<div id="mappingFormDiv"></div> ';
	html += '<div style="padding-left: 15px;margin-top: 3px;font-weight: bold;">'+npaUi.getLocalizedString('@apaf.page.user.data.import.action.dialog.line2')+'</div>';
	html += '<div style="padding-right: 15px;margin-top: 3px;height: 500px;overflow: auto;">';
	let fields = sortOn(selectedDatatype.fields,'displayIndex');
	let fieldsByName = {};
	for(var i=0;i<fields.length;i++){
		let field = fields[i];
		fieldsByName[field.name] = field;
		let type = field.type;
		if(typeof type=='undefined'){
			type = 'text';
		}
		
		html += '<div class="row" style="margin-top: 3px;">';
		html += '  <div class="col-2" style="text-align: right;">'+npaUi.getLocalizedString('@apaf.page.user.data.import.action.dialog.column.label',[i])+'</div>';
		html += '  <div class="col-4"><select id="column_'+i+'" class="form-select form-select-sm">';
		html += '    <option value="">'+npaUi.getLocalizedString('@apaf.page.user.data.import.action.dialog.mapping.empty')+'</option>';
		for(var j=0;j<fields.length;j++){
			let mappedField = fields[j];
			let selected = '';
			if(j==i){
				selected = ' selected';
			}
			html += '<option value="'+mappedField.name+'"'+selected+'>'+mappedField.label+' ('+type+')</option>';
		}
		html += '';
		html += '    </select>';
		html += '  </div>';
		html += '  <div class="col-1" style="text-align: right;">'+npaUi.getLocalizedString('@apaf.page.user.data.import.action.dialog.mapping.expr')+'</div>';
		html += '  <div class="col-5">';
		let exprValue = '';
		if('switch'==field.type || 'check'==field.type || 'option'==field.type){
			exprValue = "@ == 'true'";
		}else
		if('integer'==field.type ||
		   'range'==field.type){
			exprValue = 'parseInt(@)';
		}else
		if('text'==field.type || 
		   'password'==field.type || 
		   'passwordCheck'==field.type || 
		   'url'==field.type || 
		   'date'==field.type || 
		   'radio'==field.type || 
		   'color'==field.type || 
		   'select'==field.type){
			exprValue = '@';
		}else
			exprValue = '';
		html += '    <input id="column_'+i+'_processor" type="text" class="form-control form-control-sm" value="'+exprValue+'">';
		html += '  </div>';
		html += '</div>';
	}
	html += '';
	html += '</div>';
	html += '</div>';	
	dialog.setBody(html);
	dialog.setOnCloseCallback(function(){
		let form = $apaf(MAPPING_FORM_ID);
		let options = form.getData();
		let records = [];
		for(var i=0;i<data.length;i++){
			let line = data[i].trim();
			if(i>0 || !options.ignoreFirst){
				let values = line.split(options.separator);
				let record = {};
				let columnIndex = 0;
				for(var j=0;j<fields.length;j++){
					let mapping = $('#column_'+j).val();
					let expr = $('#column_'+j+'_processor').val();
					let currentValue = values[columnIndex];
					if(mapping && mapping.length>0 && j<values.length){
						if(expr && expr.length>0){
							let mappedValue = null;
							let toEval = 'mappedValue = '+expr.replace(/@/g,'currentValue')+';';
							try{
								eval(toEval);
								record[mapping] = mappedValue;
							}catch(t){
								console.log('error evaluating "'+toEval+'" for column '+columnIndex);
							}
						}else{
							let field = fieldsByName[mapping];
							if('integer'==field.type || 'range'==field.type){
								record[mapping] = parseInt(values[columnIndex]);
							}else
							if('switch'==field.type || 'check'==field.type || 'option'==field.type){
								record[mapping] = (values[columnIndex]=='true');
							}else
								record[mapping] = values[columnIndex];
						}
						columnIndex++;
					}
				}
				records.push(record);
			}
		}
		bulkCreateRecords(records,function(){
			$('#mappingDialogBody').remove();
		});
	});
	npaUi.renderSingleComponent('mappingFormDiv',MAPPING_FORM,function(){
		let form = $apaf(MAPPING_FORM_ID);
		form.setData({});
		form.setEditMode(true);
		dialog.open();
	});
}

createSearchQuery = function(record){
	let query = {"selector": {"$and": []}};
	let andClause = query.selector.$and;
	for(var i=0;i<selectedDatatype.fields.length;i++){
		let field = selectedDatatype.fields[i];
		if(field.isIdField){
			let andMember = {};
			let recordValue = record[field.name];
			if(typeof recordValue!='undefined'){
				andMember[field.name] = {"$eq": recordValue};
				andClause.push(andMember);
			}
		}
	}
	return query;
}

bulkCreateRecords = function(arrayOfRecords,next){
	let manager = npaUi.getComponent(GENERIC_DATA_MANAGER_ID);
	let errors = [];
	//let total = arrayOfRecords.length;
	let totalCreatedRecord = 0;
	let createRecords = function(list,index,then){
		if(index<list.length){
			let record = list[index];
			//let progress = Math.round((index/total)*100);
			manager.query(createSearchQuery(record))
			.then(function(searchResult){
				if(searchResult && searchResult.length==0){
					manager.create(record).then(function(data){
						totalCreatedRecord++;
						createRecords(list,index+1,then);
						//setTimeout(function(){ createRecords(list,index+1,then); },1000);
					}).onError(function(errorMsg){
						errors.push({"index": index,"data": record,"message": "Creating record failed"});
						createRecords(list,index+1,then);
					});
				}else{
					errors.push({"index": index,"data": record,"message": "Duplicated key"});
					createRecords(list,index+1,then);
				}
			})
			.onError(function(errorMsg){
				errors.push({"index": index,"data": record,"message": "Looking for existing record failed!"});
				createRecords(list,index+1,then);
			});
		}else{
			then();
		}
	}
	createRecords(arrayOfRecords,0,function(){
		if(errors.length>0){
			showWarning('@apaf.page.user.data.import.action.dialog.warning');
			console.error('Errors detected while importing data:');
			console.error(errors);
		}
		showInfo('@apaf.page.user.data.import.action.dialog.final.msg',[totalCreatedRecord]);
		next();
	});
}