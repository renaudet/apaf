/*
 * manageProfile.js - main javascript resource for the APAF Application Manage User's Profile Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const USER_EDIT_FORM_ID = 'profileEditForm';
const WORKFLOW_PREFERENCE_EDIT_FORM_ID = 'workflowEditorPrefsEditForm';

let userProfile = null;
$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.on('save',saveUserData);
			npaUi.on('menu.item.selected',onMenuSelected)
			npaUi.onComponentLoaded = getUserProfile;
			npaUi.on('saveWorkflowPrefs',saveWorkflowPrefs);
			npaUi.render();
		});
	});
}

onMenuSelected = function(event){
	if('preferences'==event.menu){
		openMenuPreferences();
	}
}

getUserProfile = function(){
	makeRESTCall('GET','/apaf-admin/profile',{},function(response){
		if(response.status==200){
			userProfile = response.data;
			let form = npaUi.getComponent(USER_EDIT_FORM_ID);
			let formData = Object.assign({},userProfile);
			delete formData.password;
			form.setData(formData);
			form.setEditMode(true);
		}else{
			showWarning(response.message);
		}
	},function(error){
		showError(error.message);
	});
}

saveUserData = function(){
	let form = npaUi.getComponent(USER_EDIT_FORM_ID);
	if(form.isValid()){
		let formData = form.getData();
		let updateProfileData = Object.assign({},formData);
		if(updateProfileData.password && updateProfileData.password.length>0){
			updateProfileData.password = CryptoJS.MD5(updateProfileData.password).toString();
		}
		form.setEditMode(false);
		makeRESTCall('PUT','/apaf-admin/profile',updateProfileData,function(response){
			if(response.status==200){
				userProfile = response.data;
				let form = npaUi.getComponent(USER_EDIT_FORM_ID);
				let formData = Object.assign({},userProfile);
				delete formData.password;
				form.setData(formData);
				form.setEditMode(true);
				flash('Updated!');
			}else{
				showWarning(response.message);
				form.setEditMode(true);
			}
		},function(error){
			showError(error.message);
		});
	}
}

openMenuPreferences = function(){
	let form = npaUi.getComponent(WORKFLOW_PREFERENCE_EDIT_FORM_ID);
	if(userProfile.preferences && userProfile.preferences.workflow){
		let preferences = Object.assign({},userProfile.preferences.workflow);
		form.setData(preferences);
	}
	form.setEditMode(true);
}

saveWorkflowPrefs = function(){
	let form = npaUi.getComponent(WORKFLOW_PREFERENCE_EDIT_FORM_ID);
	let preferences = form.getData();
	let profileData = {"id": userProfile.id,"preferences":{"workflow": preferences}};
	makeRESTCall('PUT','/apaf-admin/profile',profileData,function(response){
		if(response.status==200){
			userProfile = response.data;
			let form = npaUi.getComponent(USER_EDIT_FORM_ID);
			let formData = Object.assign({},userProfile);
			delete formData.password;
			form.setData(formData);
			flash('Updated!');
		}else{
			showWarning(response.message);
		}
	},function(error){
		showError(error.message);
	});
}