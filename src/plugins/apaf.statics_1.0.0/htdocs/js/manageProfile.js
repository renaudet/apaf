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
			npaUi.onComponentLoaded = getUserProfile;
			npaUi.on('save',saveUserData);
			npaUi.on('menu.item.selected',onMenuSelected);
			//npaUi.on('saveWorkflowPrefs',saveWorkflowPrefs);
			npaUi.render();
		});
	});
}

onMenuSelected = function(event){
	if('preferences'==event.menu){
		openMenuPreferences();
	}
	if('all.preferences'==event.menu){
		openMenuAllPreferences();
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

createFormDescriptor = function(preferenceDef){
	let formId = preferenceDef.id.replace(/\./g,'_');
	let actionId = 'savePref_'+preferenceDef.preference;
	let json = {"id": formId,"version": "1.0.0","type": "Form","configuration": {}};
	json.configuration.title = preferenceDef.label;
	json.configuration.class = 'form-frame-noborder';
	json.configuration.fields = preferenceDef.fields;
	let btnField = {
		"name": "saveBtn",
		"type": "button",
		"buttonType": "primary",
		"label": "@apaf.page.preferences.workflow.button.save",
		"actionId": actionId
    }
    json.configuration.fields.push(btnField);
	return json;
}

openMenuPreferences = function(){
	/*let form = npaUi.getComponent(WORKFLOW_PREFERENCE_EDIT_FORM_ID);
	if(userProfile.preferences && userProfile.preferences.workflow){
		let preferences = Object.assign({},userProfile.preferences.workflow);
		form.setData(preferences);
	}
	form.setEditMode(true);*/
	apaf.call({"method": "GET","uri": "/apaf-admin/preferences","payload": {}})
	    .then(function(preferences){
			//console.log(preferences);
			let initializeForms = function(){
				for(preferenceId in preferences){
					let preferenceDef = preferences[preferenceId];
					let formId = preferenceDef.id.replace(/\./g,'_');
					console.log('initializing form "'+formId+'"');
					let form = $apaf(formId);
					form.setData(userProfile.preferences[preferenceDef.preference]);
					form.setEditMode(true);
				}
			}
			let configureActionHandler = function(preferenceDef){
				let actionId = 'savePref_'+preferenceDef.preference;
				npaUi.on(actionId,function(){
					let formId = preferenceDef.id.replace(/\./g,'_');
					let form = npaUi.getComponent(formId);
					if(form.isValid()){
						let preference = form.getData();
						let profileData = {"id": userProfile.id,"preferences":{}};
						if(typeof userProfile.preferences!='undefined'){
							Object.assign(profileData.preferences,userProfile.preferences);
						}
						profileData.preferences[preferenceDef.preference] = preference;
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
					
				});
			}
			for(preferenceId in preferences){
				let preferenceDef = preferences[preferenceId];
				let html = '';
				html += '<div id="'+preferenceDef.id.replace(/\./g,'_')+'_div" class="user-app" data-ref="'+preferenceDef.id+'"></div>';
				$('#preferenceArea').append(html);
				npaUi.registerComponentConfig(preferenceDef.id,createFormDescriptor(preferenceDef));
				let actionId = 'savePref_'+preferenceDef.preference;
				configureActionHandler(preferenceDef);
			}
			npaUi.onComponentLoaded = initializeForms;
			npaUi.render('user-app');
	    })
	    .onError(function(errorMessage){
			showError(errorMessage);
	    });
}

/*saveWorkflowPrefs = function(){
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
}*/

openMenuAllPreferences = function(){
	$('#preferenceTreeArea').empty();
	$('#dynamicEditorArea').empty();	
	let treeViewer = new TreeViewer('preferenceViewer',$('#preferenceTreeArea')[0]);
	treeViewer.init();
	
	let preferenceVisitor = {
		getLabel(element){
			return element.name;
		},
		getChildren(element){
			if(typeof element.value == 'object'){
				let children = [];
				if(Array.isArray(element.value)){
					for(var i=0;i<element.value.length;i++){
						let itemName = element.name+'['+i+']';
						let child = {"name": itemName,"value": element.value[i]};
						child.path = element.path+'['+i+']';
						children.push(child);
					}
				}else{
					for(varName in element.value){
						let child = {"name": varName,"value": element.value[varName]};
						child.path = element.path+'.'+varName;
						children.push(child);
					}
				}
				return children;
			}else{
				return [];
			}
		},
		isParent(element){
			if(typeof element.value == 'object' && element.value!=null){
				return true;
			}else{
				return false;
			}
		}
	}
	let preferenceDecorator = {
		decorate(element,label){
			let type = typeof element.value;
			let icon = '/uiTools/img/silk/textfield.png';
			if('object'==type){
				if(Array.isArray(element.value)){
					icon = '/uiTools/img/silk/table_multiple.png';
				}else{
					icon = '/uiTools/img/silk/application_form.png';
				}
			}
			if('string'==type){
				icon = '/uiTools/img/silk/font.png';
			}
			if('number'==type){
				icon = '/uiTools/img/silk/calculator.png';
			}
			if('boolean'==type){
				icon = '/uiTools/img/silk/tick.png';
			}
			if('undefined'==type){
				icon = '/uiTools/img/silk/help.png';
			}
			if('function'==type){
				icon = '/uiTools/img/silk/page_white_actionscript.png';
			}
			return '<img src="'+icon+'">&nbsp;<b>'+label+'</b>';
		}
	} 
	let createDynamicEditor = function(pref){
		$('#propEdit').off('.propertyeditor')
		let type = typeof pref.value;
		let html = '';
		html += '<div class="row" style="margin-top: 15px;">';
		html += '	<div class="col-3 form-row-label">'+pref.name+':&nbsp;</div>';
		if('string'==type){
			html += '	<div class="col-7">';
			html += '		<input id="propEdit" type="text" class="form-control">';
		}
		if('number'==type){
			html += '	<div class="col-7">';
			html += '		<input id="propEdit" type="number" class="form-control">';
		}
		if('boolean'==type){
			html += '	<div class="col-7  form-switch">';
			html += '		<input id="propEdit" type="checkbox" role="switch" class="form-check-input" value="true">';
		}
		html += '	</div>';
		html += '	<div class="col-2">';
		html += '	  <button id="applyBtn" type="button" class="btn btn-secondary">Apply</button';
		html += '	</div>';
		html += '</div>';
		$('#dynamicEditorArea').html(html);	
		if('string'==type || 'number'==type){
			$('#propEdit').val(pref.value);
		}
		if('boolean'==type){
			$('#propEdit').prop('checked',pref.value);
		}
		$('#applyBtn').on('click.propertyeditor',function(){
			let doSave = false;
			if('string'==type){
				let value = $('#propEdit').val();
				let toEval = 'userProfile.'+pref.path+' = "'+value+'"';
				try{
					eval(toEval);
					pref.value = value;
					doSave = true;
				}catch(e){
					showError('Exception evaluating expression!');
					console.log(e);
				}
			}
			if('number'==type){
				let value = $('#propEdit').val();
				let toEval = 'userProfile.'+pref.path+' = '+value;
				try{
					eval(toEval);
					pref.value = value;
					doSave = true;
				}catch(e){
					showError('Exception evaluating expression - please check that you entered a numerical value');
					console.log(e);
				}
			}
			if('boolean'==type){
				let value = $('#propEdit').prop('checked');
				let toEval = 'userProfile.'+pref.path+' = '+value;
				try{
					eval(toEval);
					pref.value = value;
					doSave = true;
				}catch(e){
					showError('Exception evaluating expression!');
					console.log(e);
				}
			}
			if(doSave){
				apaf.savePreferences(userProfile.preferences,function(data){
					userProfile = data;
					showConfirm('updated!');
				});
			}
		});
	}
	let preferenceEventListener = {
		onNodeSelected(node){
			let pref = node.data;
			if(typeof pref.value!='object'){
				createDynamicEditor(pref);
			}else{
				$('#dynamicEditorArea').empty();	
			}
		}
	}
	
    treeViewer.setVisitor(preferenceVisitor);
    treeViewer.setDecorator(preferenceDecorator);
    treeViewer.setEventListener(preferenceEventListener);
    treeViewer.addRootData({"name": "User Preferences","value": userProfile.preferences,"path": "preferences"});
    treeViewer.refreshTree();
}