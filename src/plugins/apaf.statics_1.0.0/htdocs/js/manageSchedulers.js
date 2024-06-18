/*
 * manageSchedulers.js - main javascript resource for the APAF Application Manage Schedulers Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const SCHEDULER_FORM_ID = 'schedulerEditForm';
const SCHEDULER_TABLE_ID = 'schedulingRulesTable';
const SCHEDULER_DATA_MANAGER_ID = 'schedulerManager';

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.on('edit',editScheduler);
			npaUi.on('save',saveScheduler);
			npaUi.on('insert',createScheduler);
			npaUi.on('delete',deleteScheduler);
			npaUi.render();
		});
	});
}

refresDataTable = function(){
	let form = $apaf(SCHEDULER_FORM_ID);
	form.setData({});
	form.setEditMode(false);
	let table = $apaf(SCHEDULER_TABLE_ID);
	table.refresh();
}

createScheduler = function(){
	let form = $apaf(SCHEDULER_FORM_ID);
	form.setData({"name": "New Scheduling Rule"});
	form.setEditMode(true);
}

editScheduler = function(){
	let form = $apaf(SCHEDULER_FORM_ID);
	form.setEditMode(true);
}

saveScheduler = function(){
	let form = $apaf(SCHEDULER_FORM_ID);
	let record = form.getData();
	console.log(record);
	let exclusivCheck = typeof record.servlet!='undefined' && record.servlet.length>0 && typeof record.workflow!='undefined' && record.workflow.length>0;
	if(exclusivCheck){
		showError('@apaf.page.scheduler.error.exclusiv.check');
	}else{
		if(form.isValid()){
			let manager = npaUi.getComponent(SCHEDULER_DATA_MANAGER_ID);
			if(typeof record.id!='undefined'){
				manager.update(record).then(function(data){
					console.log(data);
					refresDataTable();
				}).onError(function(errorMsg){
					if(errorMsg.httpStatus==404){
						showError('@apaf.error.http.not.found');
					}else
						showError(errorMsg.message?errorMsg.message:errorMsg);
				});
			}else{
				manager.create(record).then(function(data){
					console.log(data);
					refresDataTable();
				}).onError(function(errorMsg){
					if(errorMsg.httpStatus==404){
						showError('@apaf.error.http.not.found');
					}else
						showError(errorMsg.message?errorMsg.message:errorMsg);
				});
			}
		}
	}
}

deleteScheduler = function(){
	let form = $apaf(SCHEDULER_FORM_ID);
	let record = form.getData();
	let manager = npaUi.getComponent(SCHEDULER_DATA_MANAGER_ID);
	if(confirm(apaf.localize('@apaf.page.scheduler.confirmation',[record.name]))){
		manager.delete(record).then(function(){
			refresDataTable();
		}).onError(function(errorMsg){
			if(errorMsg.httpStatus==404){
				showError('@apaf.error.http.not.found');
			}else
				showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	}
}