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
			npaUi.on('deleteRecord',deleteRecord);
			npaUi.on('showRecord',showRecord);
			npaUi.on('compareRecord',compareRecord);
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
let reportCount = 0;
getPreceedingRecord = function(recordId,recordList){
	let sortedList = sortOn(recordList,'timestamp');
	console.log('getPreceedingRecord#sortedList:');
	console.log(sortedList);
	let precRecord = null;
	let doTheLoop = true;
	for(var i=0;i<sortedList.length && doTheLoop;i++){
		let record = sortedList[i];
		if(record.id!=recordId){
			precRecord = record;
		}else{
			doTheLoop = false;
		}
	}
	return precRecord;
}
compareRecord = function(event){
	let record = event.item;
	let reportId = reportCount++;
	let dialogTitle = apaf.localize('@apaf.page.audit.dialog.compare.title',[record.timestamp])
	let dialog = apaf.createModalDialog({"size": "XXL","title": dialogTitle});
	let html = '';
	html += '<div id="compareReport_'+reportId+'" style="background: #ffffff;color: #16499c;font-size: 0.8rem;font-family: courier;"></div>';
	dialog.setBody(html);
	let report = '<span style="font-size: 0.9rem;font-weight: bold;">'+apaf.localize('@apaf.page.audit.dialog.compare.report.title')+'</span><br>';
	let manager = npaUi.getComponent(GENERIC_DATA_MANAGER_ID);
	let queryStr = {"selector": {"$and": [{"datatypeid": {"$eq": record.datatypeid}},{"entityid": {"$eq": record.entityid}}]}};
	manager.query(queryStr).then(function(resultSet){
		report += '<b>'+apaf.localize('@apaf.page.audit.dialog.compare.report.line1')+'</b> '+resultSet.length+'<br>';
		report += '<b>'+apaf.localize('@apaf.page.audit.dialog.compare.report.line2')+'</b> <i>'+record.event+'</i><br><br>';
		if('created'==record.event){
			report += apaf.localize('@apaf.page.audit.dialog.compare.report.line3')+'<br>';
			report += serializeObjectAsHtml(record.data);
		}else{
			// looking up for the preceding record
			let prec = getPreceedingRecord(record.id,resultSet);
			if(prec!=null){
				report += apaf.localize('@apaf.page.audit.dialog.compare.report.line4',[prec.timestamp])+'<br>';
				report += apaf.localize('@apaf.page.audit.dialog.compare.report.line5')+'<br>';
				report += serializeObjectAsHtml(compareData(prec.data,record.data));
			}else{
				report += apaf.localize('@apaf.page.audit.dialog.compare.report.line6');
			}
		}
		$('#compareReport_'+reportId).html(report);
		dialog.open();
	}).onError(function(errorMsg){
		if(errorMsg.httpStatus==404){
			showError('@apaf.error.http.not.found');
		}else
			showError(errorMsg.message?errorMsg.message:errorMsg);
	});
}

compareData = function(prec,next){
	let comp = {};
	for(var i=0;i<selectedDatatype.fields.length;i++){
		let field = selectedDatatype.fields[i];
		if(typeof prec[field.name]!='undefined'){
			if(typeof next[field.name]=='undefined'){
				comp[field.label] = apaf.localize('@apaf.page.audit.dialog.compare.report.detail1',[prec[field.name]]);
			}else{
				if(typeof field.type=='undefined' ||
				   field.type=='string' ||
				   field.type=='text' ||
				   field.type=='url' ||
				   field.type=='date' ||
				   field.type=='integer' ||
				   field.type=='range' ||
				   field.type=='color' ||
				   field.type=='switch' ||
				   field.type=='check'){
					if(prec[field.name]!=next[field.name]){
						comp[field.name] = apaf.localize('@apaf.page.audit.dialog.compare.report.detail2',['<i>'+next[field.name]+'</i>']);
					}
				}
				if(field.type=='textarea'){
					if(prec[field.name]!=next[field.name] && next[field.name].length<128){
						comp[field.name] = apaf.localize('@apaf.page.audit.dialog.compare.report.detail2',['<i>'+next[field.name]+'</i>']);
					}else{
						comp[field.name] = apaf.localize('@apaf.page.audit.dialog.compare.report.detail4');
					}
				}
				if(field.type=='array' && prec[field.name].length!=next[field.name].length){
					comp[field.label] = apaf.localize('@apaf.page.audit.dialog.compare.report.detail3',[next[field.name].length]);
				}
				if(field.type=='relationship' && !field.multiple && prec[field.name]!=next[field.name]){
					comp[field.label] = apaf.localize('@apaf.page.audit.dialog.compare.report.detail4');
				}
				if(field.type=='relationship' && field.multiple){
					if(prec[field.name].length!=next[field.name].length){
						comp[field.label] = apaf.localize('@apaf.page.audit.dialog.compare.report.detail5');
					}else{
						let differenceFound = false;
						for(var j=0;j<prec[field.name].length;j++){
							let precValue = prec[field.name][j];
							let nextValue = next[field.name][j];
							if(precValue!=nextValue){
								differenceFound = true;
							}
						}
						if(differenceFound){
							comp[field.label] = apaf.localize('@apaf.page.audit.dialog.compare.report.detail8');
						}
					}
				}
				if(field.type=='ruleDataReference' && prec[field.name]!=next[field.name]){
					comp[field.label] = apaf.localize('@apaf.page.audit.dialog.compare.report.detail6',['<i>'+next[field.name]+'</i>']);
				}
			}
		}else{
			if(typeof next[field.name]!='undefined'){
				comp[field.label] = apaf.localize('@apaf.page.audit.dialog.compare.report.detail7',[next[field.name]]);
			}
		}
	}
	return comp;
}

serializeObjectAsHtml = function(o){
	console.log('serializeObjectAsHtml()');
	console.log(o);
	let html = '';
	for(var field in o){
		console.log('field: '+field);
		html += '<b>'+apaf.localize('@apaf.page.audit.dialog.compare.report.field',[field])+'</b>&nbsp;';
		console.log('value: '+o[field]);
		html += o[field];
		html += '<br>';
	}
	return html;
}
