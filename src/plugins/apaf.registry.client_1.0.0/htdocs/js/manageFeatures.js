/*
 * manageFeatures.js - main javascript resource for the APAF Application Manage Features Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const EMPTY_DIALOG_ID = 'emptyDialog';
const CARD_ID = 'manageFeaturesCard';
const FEATURE_FORM_ID = 'featureForm';
const RESOURCE_TOOLBAR_ID = 'resourceTreeToolbar';

let treeViewer = null;
let selectedFolder = null;
let currentContainerNode = null;
let selectedNode = null;
let selectedResource = null;
let feature = {"name": "New Feature","version": "1.0.0","category": "Tool","roles": [],"datatypes": [],"workflows": [],"fragments": [],"applications": [],"ruleData":[]};
let roleCache = {};
let fragmentCache = {};
let editMode = true;

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.onComponentLoaded = initComponents;
			npaUi.on('addDep',addDependency);
			npaUi.on('removeDep',removeDependency);
			npaUi.on('menu.item.selected',onPageChanged)
			npaUi.render();
		});
	});
}

setStatus = function(status){
	let card = $apaf(CARD_ID);
	card.setStatus(status);
}

onPageChanged = function(event){
	console.log(event);
	setStatus('');
	if('import'==event.menu){
		resetImportPage();
	}
}

initComponents = function(){
	initResourceTree();
	initFeatureForm();
	initImportPage();
}

var resourceVisitor = {
	getLabel(element){
		return element.name;
	},
	getChildren(element){
		if(element['_type']){
			if('resourceType'==element['_type']){
				return element['_children'];
			}
		}
		return [];
	},
	isParent(element){
		if(element['_type']){
			if('resourceType'==element['_type']){
				return true;
			}
			return false;
		}else{
			return false;
		}
	}
}

var resourceDecorator = {
	decorate(element,label){
		if(element['_type']){
			if('resourceType'==element['_type']){
				return '<img src="/uiTools/img/silk/book.png">&nbsp;<b>'+label+'</b>';
			}
			if('fragment'==element['_type']){
				return '<img src="/uiTools/img/silk/script.png">&nbsp;'+label+'&nbsp;<small>v<i>'+element.version+'</i></small>';
			}
			if('application'==element['_type']){
				return '<img src="/uiTools/img/silk/application_form.png">&nbsp;'+label+'&nbsp;<small>v<i>'+element.version+'</i></small>';
			}
			if('datatype'==element['_type']){
				return '<img src="/uiTools/img/silk/table.png">&nbsp;'+label;
			}
			if('workflow'==element['_type']){
				return '<img src="/uiTools/img/silk/chart_organisation.png">&nbsp;'+label+'&nbsp;<small>v<i>'+element.version+'</i></small>';
			}
			if('role'==element['_type']){
				return '<img src="/uiTools/img/silk/lock.png">&nbsp;'+label;
			}
			if('ruleData'==element['_type']){
				return '<img src="/uiTools/img/silk/table_key.png">&nbsp;'+label;
			}
		}
		return label;
	}
}

var resourceEventListener = {
	onNodeSelected(node){
		setStatus('');
		let selectedItem = node.data;
		let toolbar = $apaf(RESOURCE_TOOLBAR_ID);
		toolbar.setEnabled('addDep',false);
		toolbar.setEnabled('removeDep',false);
		selectedResource = null;
		if(selectedItem['_type']){
			let statusKey = null;
			if('fragment'==selectedItem['_type']){
				statusKey = '@apaf.registry.client.status.fragment';
			}
			if('application'==selectedItem['_type']){
				statusKey = '@apaf.registry.client.status.application';
			}
			if('datatype'==selectedItem['_type']){
				statusKey = '@apaf.registry.client.status.datatype';
			}
			if('workflow'==selectedItem['_type']){
				statusKey = '@apaf.registry.client.status.workflow';
			}
			if('role'==selectedItem['_type']){
				statusKey = '@apaf.registry.client.status.role';
			}
			if('ruleData'==selectedItem['_type']){
				statusKey = '@apaf.registry.client.status.ruleData';
			}
			if(statusKey!=null){
				setStatus(apaf.localize(statusKey,[selectedItem.name,selectedItem.version]));
				toolbar.setEnabled('addDep',true);
				toolbar.setEnabled('removeDep',true);
				selectedResource = selectedItem;
			}
		}
	}
}

initResourceTree = function(){
	$('#treeArea').empty();
	treeViewer = new TreeViewer('resourcesViewer',$('#treeArea')[0]);
	treeViewer.init();
    treeViewer.setVisitor(resourceVisitor);
    treeViewer.setDecorator(resourceDecorator);
    treeViewer.setEventListener(resourceEventListener);
    loadSecurityRoles();
    loadDatatypes();
    loadWorkflows();
    loadFragments();
    loadApplications();
    loadRuleData();
}

loadDatatypes = function(){
	apaf.call({
		"method": "POST",
		"uri": "/apaf-datatype/datatype/query",
		"payload": {}
	}).then(function(data){
		let datatypeSection = {"name": apaf.localize('@apaf.registry.client.tree.section.datatypes'),"_type": "resourceType",['_children']: []};
		for(var i=0;i<data.length;i++){
			let datatype = data[i];
			datatype['_type'] = 'datatype';
			datatypeSection['_children'].push(datatype);
		}
		treeViewer.addRootData(datatypeSection);
		treeViewer.refreshTree();
	}).onError(function(errorMsg){
		showError(errorMsg.message?errorMsg.message:errorMsg);
	});
}

loadRuleData = function(){
	apaf.call({
		"method": "POST",
		"uri": "/apaf-rule-data/query",
		"payload": {}
	}).then(function(data){
		let datatypeSection = {"name": apaf.localize('@apaf.registry.client.tree.section.ruleData'),"_type": "resourceType",['_children']: []};
		for(var i=0;i<data.length;i++){
			let ruleData = data[i];
			ruleData['_type'] = 'ruleData';
			datatypeSection['_children'].push(ruleData);
		}
		treeViewer.addRootData(datatypeSection);
		treeViewer.refreshTree();
	}).onError(function(errorMsg){
		showError(errorMsg.message?errorMsg.message:errorMsg);
	});
} 

loadWorkflows = function(){
	apaf.call({
		"method": "POST",
		"uri": "/apaf-workflow/query",
		"payload": {}
	}).then(function(data){
		let workflowSection = {"name": apaf.localize('@apaf.registry.client.tree.section.workflows'),"_type": "resourceType",['_children']: []};
		for(var i=0;i<data.length;i++){
			let workflow = data[i];
			workflow['_type'] = 'workflow';
			workflowSection['_children'].push(workflow);
		}
		treeViewer.addRootData(workflowSection);
		treeViewer.refreshTree();
	}).onError(function(errorMsg){
		showError(errorMsg.message?errorMsg.message:errorMsg);
	});
}

loadSecurityRoles = function(){
	apaf.call({
		"method": "POST",
		"uri": "/apaf-admin/role/query",
		"payload": {}
	}).then(function(data){
		let section = {"name": apaf.localize('@apaf.registry.client.tree.section.roles'),"_type": "resourceType",['_children']: []};
		for(var i=0;i<data.length;i++){
			let record = data[i];
			roleCache[record.name] = record;
			record['_type'] = 'role';
			section['_children'].push(record);
		}
		treeViewer.addRootData(section);
		treeViewer.refreshTree();
	}).onError(function(errorMsg){
		showError(errorMsg.message?errorMsg.message:errorMsg);
	});
}

loadFragments = function(){
	apaf.call({
		"method": "POST",
		"uri": "/apaf-dev/fragment/query",
		"payload": {}
	}).then(function(data){
		let section = {"name": apaf.localize('@apaf.registry.client.tree.section.fragments'),"_type": "resourceType",['_children']: []};
		for(var i=0;i<data.length;i++){
			let record = data[i];
			fragmentCache[record.id] = record;
			record['_type'] = 'fragment';
			section['_children'].push(record);
		}
		treeViewer.addRootData(section);
		treeViewer.refreshTree();
	}).onError(function(errorMsg){
		showError(errorMsg.message?errorMsg.message:errorMsg);
	});
}

loadApplications = function(){
	apaf.call({
		"method": "POST",
		"uri": "/apaf-dev/application/query",
		"payload": {}
	}).then(function(data){
		let section = {"name": apaf.localize('@apaf.registry.client.tree.section.applications'),"_type": "resourceType",['_children']: []};
		for(var i=0;i<data.length;i++){
			let record = data[i];
			record['_type'] = 'application';
			section['_children'].push(record);
		}
		treeViewer.addRootData(section);
		treeViewer.refreshTree();
	}).onError(function(errorMsg){
		showError(errorMsg.message?errorMsg.message:errorMsg);
	});
}

initFeatureForm = function(){
	$('#featureArea').height($('#workArea').height()-5);
	$(window).on('resize',function(){
		$('#featureArea').height($('#workArea').height()-5);
	});
	let form = $apaf(FEATURE_FORM_ID);
	form.setData(feature);
	form.setEditMode(true);
	let html = '';
	html += '<div style="margin-left: 15px;">';
	html += '<div class="row form-row" style="margin-top: 5px;">';
	html += '  <div class="col-2 form-row-label">'+apaf.localize('@apaf.registry.client.form.applications')+':</div>';
	html += '  <div class="col-5">';
	html += '    <select id="applicationLst" class="form-select" size="2"></select>';
	html += '  </div>';
	html += '  <div class="col-5">&nbsp;</div>';
	html += '</div>';
	html += '<div class="row form-row" style="margin-top: 5px;">';
	html += '  <div class="col-2 form-row-label">'+apaf.localize('@apaf.registry.client.form.fragments')+':</div>';
	html += '  <div class="col-5">';
	html += '    <select id="fragmentLst" class="form-select" size="3"></select>';
	html += '  </div>';
	html += '  <div class="col-5">&nbsp;</div>';
	html += '</div>';
	html += '<div class="row form-row" style="margin-top: 5px;">';
	html += '  <div class="col-2 form-row-label">'+apaf.localize('@apaf.registry.client.form.workflows')+':</div>';
	html += '  <div class="col-5">';
	html += '    <select id="workflowLst" class="form-select" size="2"></select>';
	html += '  </div>';
	html += '  <div class="col-5">&nbsp;</div>';
	html += '</div>';
	html += '<div class="row form-row" style="margin-top: 5px;">';
	html += '  <div class="col-2 form-row-label">'+apaf.localize('@apaf.registry.client.form.datatypes')+':</div>';
	html += '  <div class="col-5">';
	html += '    <select id="datatypeLst" class="form-select" size="3"></select>';
	html += '  </div>';
	html += '  <div class="col-5">&nbsp;</div>';
	html += '</div>';
	html += '<div class="row form-row" style="margin-top: 5px;">';
	html += '  <div class="col-2 form-row-label">'+apaf.localize('@apaf.registry.client.form.ruleData')+':</div>';
	html += '  <div class="col-5">';
	html += '    <select id="ruleDataLst" class="form-select" size="3"></select>';
	html += '  </div>';
	html += '  <div class="col-5">&nbsp;</div>';
	html += '</div>';
	html += '<div class="row form-row" style="margin-top: 5px;">';
	html += '  <div class="col-2 form-row-label">'+apaf.localize('@apaf.registry.client.form.roles')+':</div>';
	html += '  <div class="col-5">';
	html += '    <select id="roleLst" class="form-select" size="2"></select>';
	html += '  </div>';
	html += '  <div class="col-5">&nbsp;</div>';
	html += '</div>';
	html += '<div class="row form-row" style="margin-top: 10px;">';
	html += '  <div class="col-2">&nbsp;</div>';
	html += '  <div class="col-2">';
	html += '    <button id="resetBtn" class="btn btn-warning">'+apaf.localize('@apaf.registry.client.form.reset')+'</button>';
	html += '  </div>';
	html += '  <div class="col-2">';
	html += '    <button id="publishBtn" class="btn btn-primary">'+apaf.localize('@apaf.registry.client.form.submit')+'</button>';
	html += '  </div>';
	html += '  <div class="col-6">&nbsp;</div>';
	html += '</div>';
	html += '</div>';
	$('#featureArea').append(html);
	$('#publishBtn').on('click',publishFeature);
	$('#resetBtn').on('click',resetFeature);
}

addUnique = function(resource,array,list){
	let present = false;
	for(var i=0;i<array.length;i++){
		let existingResource = array[i];
		if(existingResource.id==resource.id){
			present = true;
		}
	}
	if(!present && editMode){
		let option = '';
		option += '<option>';
		option += resource.name;
		if(typeof resource.version!='undefined'){
			option += ' v';
			option += resource.version;
		}
		option += '</option>';
		list.append(option);
		array.push(resource);
	}
}

addImplicitRole = function(roleName){
	if(typeof roleName!='undefined' && roleName!=null && roleName.length>0){
		let cachedRole = roleCache[roleName];
		if(typeof cachedRole!='undefined'){
			let implicitResource = Object.assign({},cachedRole);
			delete implicitResource['_type'];
			delete implicitResource['_id'];
			delete implicitResource['_rev'];
			addUnique(implicitResource,feature.roles,$('#roleLst'));
		}
	}
}

addDependency = function(){
	console.log(selectedResource);
	if(selectedResource['_type']){
		let resource = Object.assign({},selectedResource);
		delete resource['_type'];
		delete resource['_id'];
		delete resource['_rev'];
		if('fragment'==selectedResource['_type']){
			addUnique(resource,feature.fragments,$('#fragmentLst'));
		}
		if('application'==selectedResource['_type']){
			addUnique(resource,feature.applications,$('#applicationLst'));
			if(resource.fragments && resource.fragments.length>0){
				for(var i=0;i<resource.fragments.length;i++){
					let fragmentId = resource.fragments[i];
					let cachedFragment = fragmentCache[fragmentId];
					if(typeof cachedFragment!='undefined'){
						let implicitResource = Object.assign({},cachedFragment);
						delete implicitResource['_type'];
						delete implicitResource['_id'];
						delete implicitResource['_rev'];
						addUnique(implicitResource,feature.fragments,$('#fragmentLst'));
					}
				}
			}
			addImplicitRole(resource.restrictedToRole);
		}
		if('datatype'==selectedResource['_type']){
			addUnique(resource,feature.datatypes,$('#datatypeLst'));
			addImplicitRole(resource.readRole);
			addImplicitRole(resource.writeRole);
			addImplicitRole(resource.deleteRole);
		}
		if('workflow'==selectedResource['_type']){
			addUnique(resource,feature.workflows,$('#workflowLst'));
		}
		if('role'==selectedResource['_type']){
			addUnique(resource,feature.roles,$('#roleLst'));
		}
		if('ruleData'==selectedResource['_type']){
			addUnique(resource,feature.ruleData,$('#ruleDataLst'));
		}
		
	}
}

removeDependency = function(){
	console.log(selectedResource);
	showError('@apaf.registry.client.error.not.implemented');
}

publishFeature = function(){
	let form = $apaf(FEATURE_FORM_ID);
	if(form.isValid()){
		Object.assign(feature,form.getData());
		let callContext = {
			"method": "POST",
			"uri": "/apaf-registry/publish",
			"payload": feature
		}
		apaf.call(callContext).then(function(data){
			form.setEditMode(false);
			$('#publishBtn').prop('disabled',true);
			editMode = false;
			showConfirm('@apaf.registry.client.publish.confirmation',[feature.name]);
		}).onError(function(errorMsg){
			console.log(errorMsg);
			showError(errorMsg);
		});
	}
}

resetFeature = function(){
	$('#fragmentLst').empty();
	$('#applicationLst').empty();
	$('#roleLst').empty();
	$('#workflowLst').empty();
	$('#datatypeLst').empty();
	$('#ruleDataLst').empty();
	feature = {"name": "New Feature","version": "1.0.0","category": "Tool","roles": [],"datatypes": [],"workflows": [],"fragments": [],"applications": [],"ruleData": []};
	let form = $apaf(FEATURE_FORM_ID);
	form.setData(feature);
	form.setEditMode(true);
	$('#publishBtn').prop('disabled',false);
	editMode = true;
}

initImportPage = function(){
	let maxHeight = $('#workArea').height()-80;
	$('#searchResult').height(maxHeight);
	$('#searchResult').css('max-height',maxHeight+'px');
	$('#searchCategory option:first').html(apaf.localize('@apaf.registry.client.import.any'));
	$('#searchBtn').on('click',function(){
		let name = $('#searchName').val();
		let category = $('#searchCategory').val();
		let params = 'name='+encodeURIComponent(typeof name!='undefined'?name:'')+'&category='+encodeURIComponent(typeof category!='undefined'?category:'')+'&summary=true';
		let callContext = {
			"method": "GET",
			"uri": "/apaf-registry/catalog?"+params,
			"payload": {}
		}
		let loadFullFeature = function(featureId,then){
			let uri = '/apaf-registry/feature/'+featureId;
			let loadFeatureCallContext = {
				"method": "GET",
				"uri": uri,
				"payload": {}
			}
			apaf.call(loadFeatureCallContext)
			    .then(function(data){
					if(data && data.status==200){
						then(null,data.data);
					}else{
						then(data.message,null);
					}
				})
			    .onError(function(errorMsg){
					then(errorMsg,null);
			    });
		}
		let configureInstallBtn = function(btnId,feature){
			$('#'+btnId).on('click',function(){
				loadFullFeature(feature.id,function(err,fullFeature){
					if(err){
						console.log(err);
						showError(err);
					}else{
						let installCallContext = {
							"method": "PUT",
							"uri": "/apaf-registry/install",
							"payload": fullFeature
						}
						apaf.call(installCallContext)
						    .then(function(data){
								showInfo('@apaf.registry.client.import.installed',[fullFeature.name]);
								$('#'+btnId).prop('disabled',true);
							})
						    .onError(function(errorMsg){
								console.log(errorMsg);
								showError(errorMsg);
						    });
				    }
				});
			});
		}
		apaf.call(callContext).then(function(data){
			if(data.status==200){
				$('#searchResult').empty();	
				let features = data.data;
				if(features && features.length>0){
					for(var i=0;i<features.length;i++){
						let feature = features[i];
						let installBtnId = 'install_btn_'+i;
						let html = '';
						html += '<div class="search-result">';
						html += '  <div class="row">';
						html += '    <div class="col-1">&nbsp;</div>';
						html += '    <div class="col-7 feature-title">'+feature.name+'&nbsp;<span class="feature-version">v'+feature.version+'</span></div>';
						html += '    <div class="col-4">&nbsp;</div>';
						html += '  </div>';
						html += '  <div class="row">';
						html += '    <div class="col-1">&nbsp;</div>';
						html += '    <div class="col-4 feature-copyright"><b>&copy;'+apaf.localize('@apaf.registry.client.import.copyright')+'</b>&nbsp;'+feature.copyright+'</div>';
						html += '    <div class="col-5 feature-category"><b>'+apaf.localize('@apaf.registry.client.import.category')+'</b>&nbsp;'+feature.category+'</div>';
						html += '    <div class="col-2"><button type="button" id="'+installBtnId+'" class="btn btn-sm btn-secondary">'+apaf.localize('@apaf.registry.client.import.install')+'</button></div>';
						html += '  </div>';
						html += '  <div class="row" style="margin-top: 20px;">';
						html += '    <div class="col-1">&nbsp;</div>';
						html += '    <div class="col-2">'+(feature.icon?'<img src="'+feature.icon+'" width="100">':'')+'</div>';
						html += '    <div class="col-8 feature-description">'+feature.description+'</div>';
						html += '    <div class="col-1">&nbsp;</div>';
						html += '  </div>';
						html += '</div>';
						$('#searchResult').append(html);
						configureInstallBtn(installBtnId,feature);
					}
				}
			}else{
				showWarning(data.message);
			}
		}).onError(function(errorMsg){
			console.log(errorMsg);
			showError(errorMsg);
		});
	});
}

resetImportPage = function(){
	$('#searchResult').empty();	
}
