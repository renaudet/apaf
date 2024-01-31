/*
 * manageProfile.js - main javascript resource for the APAF Application Manage User's Profile Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const USER_EDIT_FORM_ID = 'profileEditForm';

let userProfile = null;
$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.on('save',saveUserData);
			npaUi.onComponentLoaded = getUserProfile;
			npaUi.render();
		});
	});
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