/*
 * manageApis.js - main javascript resource for the APAF Application Manage APIs Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const DIALOG_ID = 'simpleDialog';
const TOKEN_EDIT_FORM_ID = 'tokenEditForm';
const DATA_MANAGER_ID = 'tokenManager';
const DATATABLE_ID = 'tokenTable';
const WORKSPACE_TOOLBAR_ID = 'workspaceTreeToolbar';
const WORKSPACE_EDITOR_ID = 'workspaceFileEditor';

let treeViewer = null;
let selectedFolder = null;
let currentContainerNode = null;
let selectedNode = null;

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.onComponentLoaded = initComponents;
			npaUi.on('addToken',addToken);
			npaUi.on('deleteToken',deleteToken);
			npaUi.on('newProject',newProject);
			npaUi.on('newFolder',newFolder);
			npaUi.on('saveFile',saveEditorFile);
			npaUi.on('deleteResource',deleteResource);
			npaUi.render();
		});
	});
}

initComponents = function(){
	initWorkspaceViewer();
}

addToken = function(){
	let tokenEditForm = npaUi.getComponent(TOKEN_EDIT_FORM_ID);
	tokenEditForm.setData({});
	tokenEditForm.setEditMode(true);
	let dialog = npaUi.getComponent(DIALOG_ID);
	dialog.onClose(function(){
		let tokenData = tokenEditForm.getData();
		createToken(tokenData);
	});
	dialog.open();
}

createToken = function(tokenData){
	let dataManager = npaUi.getComponent(DATA_MANAGER_ID);
	dataManager.update(tokenData).then(function(data){
		let datatable = npaUi.getComponent(DATATABLE_ID);
		datatable.refresh();
	}).onError(function(errorMsg){
		if(errorMsg.httpStatus==404){
			showError('@apaf.error.http.not.found');
		}else
			showError(errorMsg.message?errorMsg.message:errorMsg);
	});
}

deleteToken = function(event){
	let selectedToken = event.item;
	if(confirm(npaUi.getLocalizedString('@apaf.page.apis.confirm.delete'))){
		let dataManager = npaUi.getComponent(DATA_MANAGER_ID);
		dataManager.delete(selectedToken).then(function(data){
			let datatable = npaUi.getComponent(DATATABLE_ID);
			datatable.refresh();
			flash('@apaf.page.apis.deleted');
		}).onError(function(errorMsg){
			if(errorMsg.httpStatus==404){
				showError('@apaf.error.http.not.found');
			}else
				showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	}
}

readFolderContent = function(project,folder,processData){
  apaf.call({
      "method": "GET",
      "uri": "/apaf-workspace/folder?project="+project+'&folder='+folder,
      "payload": {}
   }).then(processData).onError(function(msg){
      showError(msg);
   });
}

var filesystemVisitor = {
	getLabel(element){
		if(element.createdBy){
			return element.displayName;
		}else
			return element.name;
	},
	getChildren(element){
		if('directory'==element.type || element.createdBy){
			if(element.loaded){
				return element.children;
			}else{
				return [];
			}
		}else{
			return [];
		}
	},
	isParent(element){
		if(element.createdBy){
			return true;
		}else
		if('directory'==element.type){
			return true;
		}else{
			return false;
		}
	}
}

var filesystemDecorator = {
	decorate(element,label){
		if(element.createdBy){
			return '<img src="/uiTools/img/silk/book.png">&nbsp;<b>'+label+'</b>';
		}
		if(element.type){
			if('file'==element.type){
				return '<img src="/uiTools/img/silk/page_white_text.png">&nbsp;'+label;
			}
			if('directory'==element.type){
				return '<img src="/uiTools/img/silk/folder.png">&nbsp;<b>'+label+'</b>';
			}
		}
		return label;
	}
}

var filesystemEventListener = {
	onNodeSelected(node){
		selectedNode = node;
		let toolbar = npaUi.getComponent(WORKSPACE_TOOLBAR_ID);
		toolbar.setEnabled('deleteResource',true);
		let fsObject = node.data;
		if(fsObject.createdBy || 'directory'==fsObject.type){
			selectedFolder = fsObject;
			currentContainerNode = node;
			toolbar.setEnabled('newFolder',true);
			if(!fsObject.loaded){
				let project = '';
				let folderPath = '';
				if('directory'==fsObject.type){
					project = fsObject.project;
					folderPath = fsObject.path;
				}else{
					project = fsObject.name;
					folderPath = '';
				}
				readFolderContent(project,folderPath,function(entries){
					fsObject.children = entries;
					for(var i=0;i<entries.length;i++){
						let entry = entries[i];
						entry.project = project;
						entry.path = fsObject.createdBy?entry.name:fsObject.path+'/'+entry.name;
						let treeNode = node.tree.createTreeStructure(node.id+'_child_'+i,entry);
						node.addChild(treeNode);
					}
					fsObject.loaded = true;
					treeViewer.refreshTree();
				});
			}
			updateEditorContent(null);
		}
		if('file'==fsObject.type && (
			fsObject.name.endsWith('.txt') ||
			fsObject.name.endsWith('.log') ||
			fsObject.name.endsWith('.project') ||
			fsObject.name.endsWith('.json') ||
			fsObject.name.endsWith('.js') ||
			fsObject.name.endsWith('.cmd') ||
			fsObject.name.endsWith('.csv') ||
			fsObject.name.endsWith('.html') ||
			fsObject.name.endsWith('.css')
		)){
			updateEditorContent(fsObject);
		}
	}
}

initWorkspaceViewer = function(){
	$('#treeArea').empty();
	treeViewer = new TreeViewer('workspaceViewer',$('#treeArea')[0]);
	treeViewer.init();
    treeViewer.setVisitor(filesystemVisitor);
    treeViewer.setDecorator(filesystemDecorator);
    treeViewer.setEventListener(filesystemEventListener);
    apaf.call({
		"method": "POST",
		"uri": "/apaf-workspace/project/find",
		"payload": {}
	}).then(function(data){
		for(var i=0;i<data.length;i++){
			let project = data[i];
			project.children = [];
			project.loaded = false;
			treeViewer.addRootData(project);
		}
		treeViewer.refreshTree();
	}).onError(function(errorMsg){
		showError(errorMsg.message?errorMsg.message:errorMsg);
	});
}

newProject = function(){
	let projectName = prompt(npaUi.getLocalizedString('@apaf.workspace.toolbar.action.new.prompt'));
	let projectInfo = {};
	projectInfo.name = projectName;
	projectInfo.displayName = projectName;
	projectInfo.type = 'general';
	apaf.call({
		"method": "POST",
		"uri": "/apaf-workspace/project",
		"payload": projectInfo
	}).then(function(data){
		treeViewer.addRootData(data);
		treeViewer.refreshTree();
	}).onError(function(errorMsg){
		showError(errorMsg.message?errorMsg.message:errorMsg);
	});
}

newFolder = function(){
	if(selectedFolder!=null){
	  let newFolderName = prompt(npaUi.getLocalizedString('@apaf.workspace.toolbar.action.new.folder.prompt'));
	  let project = '';
	  let folderPath = '';
	  if('directory'==selectedFolder.type){
		project = selectedFolder.project;
		folderPath = selectedFolder.path+'/'+newFolderName;
	  }else{
		project = selectedFolder.name;
		folderPath = newFolderName;
	  }
	  let ctx = {"project": project,"folder": folderPath};
	  apaf.call({
	      "method": "POST",
	      "uri": "/apaf-workspace/folder",
	      "payload": ctx
	   }).then(function(data){
		 let entry = {"name": newFolderName,"type": "directory","project": project,"path": folderPath};
		 let treeNode = currentContainerNode.tree.createTreeStructure(currentContainerNode.id+'_'+newFolderName,entry);
		 currentContainerNode.addChild(treeNode);
		 selectedFolder.children.push(entry);
	     treeViewer.refreshTree();
	   }).onError(function(msg){
	      showError(msg);
	   });
	}
}

var selectedFile = null;
updateEditorContent = function(file){
	if(file!=null){
	   selectedFile = file;
	   let toEncrypt = file.project+'/'+file.path; 
	   console.log('toEncrypt: '+toEncrypt);
	   let encrypted = btoa(toEncrypt);
	   apaf.call({
	      "method": "GET",
	      "uri": "/apaf-workspace/file/"+encrypted,
	      "payload": {}
	   }).then(function(data){
		 let editor = npaUi.getComponent(WORKSPACE_EDITOR_ID);
		 editor.setText(data);
		 editor.setEnabled('editFile',true);
		 editor.setEnabled('saveFile',false);
		 editor.setReadonly(true);
	   }).onError(function(msg){
	      showError(msg);
	   });
	}else{
		let editor = npaUi.getComponent(WORKSPACE_EDITOR_ID);
		editor.setText('');
		editor.setEnabled('editFile',false);
		editor.setEnabled('saveFile',false);
		editor.setReadonly(true);
	}
}

saveEditorFile = function(){
   let editor = npaUi.getComponent(WORKSPACE_EDITOR_ID);
   let content = editor.getText();
   let toEncrypt = selectedFile.project+'/'+selectedFile.path; 
   let encrypted = btoa(toEncrypt);
   apaf.put({
      "uri": "/apaf-workspace/file/"+encrypted,
      "payload": content,
	  "contentType": "text/plain"
   }).then(function(data){
	 editor.setEnabled('editFile',true);
	 editor.setEnabled('saveFile',false);
	 editor.setReadonly(true);
	 showConfirm('@apaf.workspace.editor.save.confirmation',[toEncrypt]);
   }).onError(function(msg){
      showError(msg);
   });
}

deleteResource = function(){
	let fsObject = selectedNode.data;
	let confirmTxt = '';
	let toEncrypt = '';
	if(fsObject.createdBy){
		confirmTxt = npaUi.getLocalizedString('@apaf.workspace.toolbar.action.delete.project.confirmation');
		toEncrypt = fsObject.name; 
	}else{
		if('directory'==fsObject.type){
			confirmTxt = npaUi.getLocalizedString('@apaf.workspace.toolbar.action.delete.folder.confirmation');
		}else{
			confirmTxt = npaUi.getLocalizedString('@apaf.workspace.toolbar.action.delete.file.confirmation');
		}
		toEncrypt = fsObject.project+'/'+fsObject.path; 
	}
	if(confirm(confirmTxt)){
		let encrypted = btoa(toEncrypt);
		apaf.call({
	      "method": "DELETE",
	      "uri": "/apaf-workspace/"+encrypted,
	      "payload": {}
	   }).then(function(data){
		 initWorkspaceViewer();
	   }).onError(function(msg){
	      showError(msg);
	   });
	}
}