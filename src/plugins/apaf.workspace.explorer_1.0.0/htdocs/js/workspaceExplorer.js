/*
 * workspaceExplorer.js - main javascript resource for the APAF Workspace Explorer Page
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';

const TEXT_EXTENSIONS  = ['txt','log','json','js','html','htm','css','csv','java','py','sh','bat','cmd','jtp','xml','md','yaml','yml','project'];
const IMAGE_EXTENSIONS = ['png','jpg','jpeg','gif','bmp','tiff','tif'];
const BINARY_EXTENSIONS = ['pdf','zip','pptx','ppt','docx','doc','xlsx','xls','db'];

const FILE_ICON = {
	"txt":   "/uiTools/img/silk/page_white_text.png",
	"json":  "/uiTools/img/silk/page_white_wrench.png",
	"png":   "/uiTools/img/silk/page_white_picture.png",
	"jpg":   "/uiTools/img/silk/page_white_camera.png",
	"jpeg":  "/uiTools/img/silk/page_white_camera.png",
	"gif":   "/uiTools/img/silk/page_white_picture.png",
	"bmp":   "/uiTools/img/silk/page_white_picture.png",
	"tiff":  "/uiTools/img/silk/page_white_picture.png",
	"tif":   "/uiTools/img/silk/page_white_picture.png",
	"pdf":   "/uiTools/img/silk/page_white_acrobat.png",
	"zip":   "/uiTools/img/silk/page_white_compressed.png",
	"htm":   "/uiTools/img/silk/page_white_code.png",
	"html":  "/uiTools/img/silk/page_white_code.png",
	"css":   "/uiTools/img/silk/page_white_code.png",
	"sql":   "/uiTools/img/silk/page_white_database.png",
	"ppt":   "/uiTools/img/silk/page_white_powerpoint.png",
	"pptx":  "/uiTools/img/silk/page_white_powerpoint.png",
	"doc":   "/uiTools/img/silk/page_white_word.png",
	"docx":  "/uiTools/img/silk/page_word.png",
	"xls":   "/uiTools/img/silk/page_white_excel.png",
	"xlsx":  "/uiTools/img/silk/page_excel.png",
	"cmd":   "/uiTools/img/silk/page_white_gear.png",
	"bat":   "/uiTools/img/silk/page_white_gear.png",
	"sh":    "/uiTools/img/silk/page_white_gear.png",
	"log":   "/uiTools/img/silk/page_white_text.png",
	"js":    "/uiTools/img/silk/page_white_csharp.png",
	"java":  "/uiTools/img/silk/page_code.png",
	"py":    "/uiTools/img/silk/page_code.png",
	"db":    "/uiTools/img/silk/database_save.png",
	"xml":   "/uiTools/img/silk/page_white_code.png",
	"md":    "/uiTools/img/silk/page_white_text.png",
	"default": "/uiTools/img/silk/page_white.png"
};

/* ===== State ===== */
var treeViewer = null;
var selectedNode = null;
var selectedFolder = null;   // project or directory node currently selected as container
var currentContainerNode = null;
var selectedFile = null;
var editorDirty = false;

/* ===== Entry point ===== */

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE, function(){
		npaUi.initialize(function(){
			npaUi.onComponentLoaded = function(){
				localizeUi();
				initWorkspaceViewer();
				initToolbar();
				initUploadModal();
				resizeColumns();
				$(window).on('resize', resizeColumns);
			};
			npaUi.render();
		});
	});
}

/* ===== i18n ===== */

decodeHtmlEntities = function(str){
	return $('<textarea>').html(str).text();
}

localizeUi = function(){
	$('#wexHintText').html(npaUi.getLocalizedString('@apaf.workspace.explorer.hint'));
	$('#wexDropHint').html(npaUi.getLocalizedString('@apaf.workspace.explorer.drop.hint'));
	$('#wexImageMetaNameLabel').html(npaUi.getLocalizedString('@apaf.workspace.explorer.image.meta.name'));
	$('#wexImageMetaSizeLabel').html(npaUi.getLocalizedString('@apaf.workspace.explorer.image.meta.size'));
	$('#wexImageMetaDimLabel').html(npaUi.getLocalizedString('@apaf.workspace.explorer.image.meta.dimensions'));
	$('#btnEditLabel').html(npaUi.getLocalizedString('@apaf.workspace.explorer.editor.btn.edit'));
	$('#btnSaveLabel').html(npaUi.getLocalizedString('@apaf.workspace.explorer.editor.btn.save'));
	$('#btnDownloadLabel').html(npaUi.getLocalizedString('@apaf.workspace.explorer.toolbar.download'));
	$('#wexUploadTitle').html(npaUi.getLocalizedString('@apaf.workspace.explorer.toolbar.upload.dialog.title'));
	$('#wexUploadFieldLabel').html(npaUi.getLocalizedString('@apaf.workspace.explorer.toolbar.upload.dialog.field'));
	$('#wexUploadSubmitBtn').html(npaUi.getLocalizedString('@apaf.workspace.explorer.toolbar.upload.dialog.btn'));
}

/* ===== Layout ===== */

resizeColumns = function(){
	var workAreaHeight = $('#workArea').height();
	if(workAreaHeight && workAreaHeight > 0){
		$('#wexLeftCol').css('height', workAreaHeight + 'px');
		$('#wexRightCol').css({'height': workAreaHeight+'px', 'overflow-y': 'auto'});
	}
}

/* ===== Toolbar ===== */

initToolbar = function(){
	npaUi.on('newProject',    newProject);
	npaUi.on('newFolder',     newFolder);
	npaUi.on('newFile',       newFile);
	npaUi.on('uploadFile',    uploadFile);
	npaUi.on('downloadFile',  downloadFile);
	npaUi.on('deleteResource',deleteResource);
	$('#btnEdit').on('click',  startEdit);
	$('#btnSave').on('click',  saveFile);
	$('#btnBinaryDownload').on('click', function(){
		if(selectedFile) doDownload(binaryFileUrl(selectedFile));
	});
}

setToolbarState = function(hasSelection, isContainer, isFile){
	var tb = npaUi.getComponent('wexToolbar');
	tb.setEnabled('newFolder',     isContainer);
	tb.setEnabled('newFile',       isContainer);
	tb.setEnabled('uploadFile',    isContainer);
	tb.setEnabled('downloadFile',  isFile);
	tb.setEnabled('deleteResource',hasSelection);
}

/* ===== Tree visitor / decorator / event listener ===== */

var filesystemVisitor = {
	getLabel(element){
		return element.createdBy ? element.displayName : element.name;
	},
	getChildren(element){
		if(element.createdBy || 'directory' == element.type){
			return element.loaded ? element.children : [];
		}
		return [];
	},
	isParent(element){
		return !!(element.createdBy || 'directory' == element.type);
	}
};

fileExt = function(name){
	let idx = name.lastIndexOf('.');
	return idx >= 0 ? name.substring(idx + 1).toLowerCase() : '';
}

fileToIcon = function(name){
	let ext = fileExt(name);
	return FILE_ICON[ext] || FILE_ICON['default'];
}

isTextFile = function(name){ return TEXT_EXTENSIONS.indexOf(fileExt(name)) >= 0; }
isImageFile = function(name){ return IMAGE_EXTENSIONS.indexOf(fileExt(name)) >= 0; }
isBinaryFile = function(name){ return BINARY_EXTENSIONS.indexOf(fileExt(name)) >= 0; }

var filesystemDecorator = {
	decorate(element, label){
		if(element.createdBy){
			return '<img src="/uiTools/img/silk/book.png">&nbsp;<b>' + label + '</b>';
		}
		if('directory' == element.type){
			return '<img src="/uiTools/img/silk/folder.png">&nbsp;<b>' + label + '</b>';
		}
		if('file' == element.type){
			let size = '';
			if(Number.isInteger(element.size)){
				size = element.size < 1024
					? (element.size + ' o')
					: element.size < 1048576
						? ((element.size / 1024).toFixed(1) + ' Ko')
						: ((element.size / 1048576).toFixed(1) + ' Mo');
				size = '&nbsp;<small><i>' + size + '</i></small>';
			}
			return '<img src="' + fileToIcon(label) + '">&nbsp;' + label + size;
		}
		return label;
	}
};

var filesystemEventListener = {
	onNodeSelected(node){
		selectedNode = node;
		let fsObject = node.data;

		// Reset right panel
		showPanel('hint');
		setToolbarState(true, false, false);
		selectedFile = null;

		if(fsObject.createdBy || 'directory' == fsObject.type){
			// Container selected
			selectedFolder = fsObject;
			currentContainerNode = node;
			setToolbarState(true, true, false);

			if(!fsObject.loaded){
				loadFolderChildren(fsObject, node);
			}
		}else if('file' == fsObject.type){
			setToolbarState(true, false, true);
			selectedFile = fsObject;

			if(isTextFile(fsObject.name)){
				loadTextFile(fsObject);
			}else if(isImageFile(fsObject.name)){
				showImageFile(fsObject);
			}else{
				showBinaryFile(fsObject);
			}
		}
	}
};

/* ===== Folder loading ===== */

loadFolderChildren = function(fsObject, node){
	let project = fsObject.createdBy ? fsObject.name : fsObject.project;
	let folderPath = fsObject.createdBy ? '' : fsObject.path;

	apaf.call({
		"method": "GET",
		"uri": "/apaf-workspace/folder?project=" + encodeURIComponent(project) + "&folder=" + encodeURIComponent(folderPath),
		"payload": {}
	}).then(function(entries){
		fsObject.children = entries;
		for(var i = 0; i < entries.length; i++){
			let entry = entries[i];
			entry.project  = project;
			entry.path     = fsObject.createdBy ? entry.name : fsObject.path + '/' + entry.name;
			let treeNode   = node.tree.createTreeStructure(node.id + '_child_' + i, entry);
			node.addChild(treeNode);
		}
		fsObject.loaded = true;
		treeViewer.refreshTree();
	}).onError(function(msg){
		showError(msg);
	});
}

/* ===== Right panel management ===== */

showPanel = function(which){
	$('#wexHint').hide();
	$('#wexEditorPanel').hide();
	$('#wexImagePanel').hide();
	$('#wexBinaryPanel').hide();
	if(which == 'hint')   $('#wexHint').show();
	if(which == 'editor') $('#wexEditorPanel').show();
	if(which == 'image')  $('#wexImagePanel').show();
	if(which == 'binary') $('#wexBinaryPanel').show();
}

/* ===== Text editor ===== */

loadTextFile = function(fsObject){
	let encrypted = btoa(fsObject.project + '/' + fsObject.path);
	apaf.call({
		"method": "GET",
		"uri": "/apaf-workspace/file/" + encrypted,
		"payload": {}
	}).then(function(content){
		$('#wexEditorArea').val(content).prop('readonly', true);
		$('#btnEdit').prop('disabled', false);
		$('#btnSave').prop('disabled', true);
		editorDirty = false;
		showPanel('editor');
	}).onError(function(msg){
		showError(msg);
	});
}

startEdit = function(){
	$('#wexEditorArea').prop('readonly', false).focus();
	$('#btnEdit').prop('disabled', true);
	$('#btnSave').prop('disabled', false);
	editorDirty = true;
}

saveFile = function(){
	if(!selectedFile) return;
	let content   = $('#wexEditorArea').val();
	let encrypted = btoa(selectedFile.project + '/' + selectedFile.path);
	apaf.put({
		"uri": "/apaf-workspace/file/" + encrypted,
		"payload": content,
		"contentType": "text/plain"
	}).then(function(){
		$('#wexEditorArea').prop('readonly', true);
		$('#btnEdit').prop('disabled', false);
		$('#btnSave').prop('disabled', true);
		editorDirty = false;
		showConfirm('@apaf.workspace.explorer.editor.save.confirm', [selectedFile.project + '/' + selectedFile.path]);
	}).onError(function(msg){
		showError(msg);
	});
}

/* ===== Image viewer ===== */

showImageFile = function(fsObject){
	let url = binaryFileUrl(fsObject);
	$('#wexImageMetaName').text(fsObject.name);
	$('#wexImageMetaSize').text(Number.isInteger(fsObject.size) ? formatFileSize(fsObject.size) : '—');
	$('#wexImageMetaDimRow').hide();
	var img = $('#wexImageView');
	img.attr('src', url);
	img.off('load.wex').on('load.wex', function(){
		$('#wexImageMetaDim').text(this.naturalWidth + ' × ' + this.naturalHeight + ' px');
		$('#wexImageMetaDimRow').show();
	});
	showPanel('image');
}

formatFileSize = function(bytes){
	if(bytes < 1024) return bytes + ' o';
	if(bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
	return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

/* ===== Binary panel ===== */

showBinaryFile = function(fsObject){
	$('#wexBinaryInfo').text(fsObject.name + (Number.isInteger(fsObject.size) ? '  —  ' + fsObject.size + ' o' : ''));
	showPanel('binary');
}

binaryFileUrl = function(fsObject){
	let path = fsObject.project + '/' + fsObject.path;
	return '/apaf-workspace/binaryFile/' + btoa(path);
}

doDownload = function(url){
	const a = document.createElement('a');
	a.href = url;
	a.download = url.split('/').pop();
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

downloadFile = function(){
	if(selectedFile) doDownload(binaryFileUrl(selectedFile));
}

/* ===== Workspace loading ===== */

initWorkspaceViewer = function(){
	$('#wexTreeArea').empty();
	treeViewer = new TreeViewer('workspaceExplorer', $('#wexTreeArea')[0]);
	treeViewer.init();
	treeViewer.setVisitor(filesystemVisitor);
	treeViewer.setDecorator(filesystemDecorator);
	treeViewer.setEventListener(filesystemEventListener);
	loadProjects();
}

loadProjects = function(){
	// Reset state
	selectedNode = null;
	selectedFolder = null;
	currentContainerNode = null;
	selectedFile = null;
	showPanel('hint');
	setToolbarState(false, false, false);
	$('#wexTreeArea').empty();
	treeViewer = new TreeViewer('workspaceExplorer', $('#wexTreeArea')[0]);
	treeViewer.init();
	treeViewer.setVisitor(filesystemVisitor);
	treeViewer.setDecorator(filesystemDecorator);
	treeViewer.setEventListener(filesystemEventListener);
	initDropTarget($('#wexTreeArea'));

	apaf.call({
		"method": "POST",
		"uri": "/apaf-workspace/project/find",
		"payload": {}
	}).then(function(data){
		for(var i = 0; i < data.length; i++){
			let project = data[i];
			project.children = [];
			project.loaded   = false;
			treeViewer.addRootData(project);
		}
		treeViewer.refreshTree();
	}).onError(function(msg){
		showError(msg.message ? msg.message : msg);
	});
}

/* ===== CRUD operations ===== */

newProject = function(){
	let name = prompt(npaUi.getLocalizedString('@apaf.workspace.explorer.toolbar.new.project.prompt'));
	if(!name || name.trim().length == 0) return;
	name = name.trim();
	apaf.call({
		"method": "POST",
		"uri": "/apaf-workspace/project",
		"payload": {"name": name, "displayName": name, "type": "general"}
	}).then(function(data){
		data.children = [];
		data.loaded   = false;
		treeViewer.addRootData(data);
		treeViewer.refreshTree();
		showConfirm('@apaf.workspace.explorer.new.project.created', [name]);
	}).onError(function(msg){
		showError(msg.message ? msg.message : msg);
	});
}

newFolder = function(){
	if(!selectedFolder) return;
	let folderName = prompt(npaUi.getLocalizedString('@apaf.workspace.explorer.toolbar.new.folder.prompt'));
	if(!folderName || folderName.trim().length == 0) return;
	folderName = folderName.trim();

	let project    = selectedFolder.createdBy ? selectedFolder.name : selectedFolder.project;
	let folderPath = selectedFolder.createdBy ? folderName : selectedFolder.path + '/' + folderName;

	apaf.call({
		"method": "POST",
		"uri": "/apaf-workspace/folder",
		"payload": {"project": project, "folder": folderPath}
	}).then(function(){
		let entry    = {"name": folderName, "type": "directory", "project": project, "path": folderPath, "children": [], "loaded": false};
		let treeNode = currentContainerNode.tree.createTreeStructure(currentContainerNode.id + '_' + folderName, entry);
		currentContainerNode.addChild(treeNode);
		selectedFolder.children.push(entry);
		treeViewer.refreshTree();
		showConfirm('@apaf.workspace.explorer.new.folder.created');
	}).onError(function(msg){
		showError(msg.message ? msg.message : msg);
	});
}

newFile = function(){
	if(!selectedFolder) return;
	let fileName = prompt(npaUi.getLocalizedString('@apaf.workspace.explorer.toolbar.new.file.prompt'));
	if(!fileName || fileName.trim().length == 0) return;
	fileName = fileName.trim();

	let project      = selectedFolder.createdBy ? selectedFolder.name : selectedFolder.project;
	let containerPath = selectedFolder.createdBy ? selectedFolder.name : selectedFolder.project + '/' + selectedFolder.path;
	let filePath     = selectedFolder.createdBy ? fileName : selectedFolder.path + '/' + fileName;
	let encrypted    = btoa(containerPath + '/' + fileName);

	apaf.put({
		"uri": "/apaf-workspace/file/" + encrypted,
		"payload": "",
		"contentType": "text/plain"
	}).then(function(){
		let entry    = {"name": fileName, "type": "file", "project": project, "path": filePath, "size": 0};
		let treeNode = currentContainerNode.tree.createTreeStructure(currentContainerNode.id + '_child_' + Math.floor(Math.random() * 100000), entry);
		currentContainerNode.addChild(treeNode);
		currentContainerNode.open();
		selectedFolder.children.push(entry);
		treeViewer.refreshTree();
		showConfirm('@apaf.workspace.explorer.new.file.created', [fileName]);
	}).onError(function(msg){
		showError(msg.message ? msg.message : msg);
	});
}

deleteResource = function(){
	if(!selectedNode) return;
	let fsObject = selectedNode.data;
	let confirmKey = fsObject.createdBy
		? '@apaf.workspace.explorer.delete.project.confirm'
		: ('directory' == fsObject.type
			? '@apaf.workspace.explorer.delete.folder.confirm'
			: '@apaf.workspace.explorer.delete.file.confirm');

	if(!confirm(npaUi.getLocalizedString(confirmKey))) return;

	let toEncrypt = fsObject.createdBy
		? fsObject.name
		: fsObject.project + '/' + fsObject.path;
	let encrypted = btoa(toEncrypt);

	apaf.call({
		"method": "DELETE",
		"uri": "/apaf-workspace/" + encrypted,
		"payload": {}
	}).then(function(){
		showConfirm('@apaf.workspace.explorer.confirm.deleted');
		loadProjects();
	}).onError(function(msg){
		showError(msg.message ? msg.message : msg);
	});
}

/* ===== Upload ===== */

initUploadModal = function(){
	$('#wexUploadCloseBtn').on('click', function(){ $('#wexUploadModal').hide(); });
	$('#wexUploadSubmitBtn').on('click', function(){
		var file = $('#wexUploadInput').get(0).files[0];
		if(!file || !selectedFolder) return;

		var formdata = new FormData();
		formdata.append("data", file);

		let project       = selectedFolder.createdBy ? selectedFolder.name : selectedFolder.project;
		let absolutePath  = selectedFolder.createdBy ? selectedFolder.name : selectedFolder.project + '/' + selectedFolder.path;
		let filePath      = selectedFolder.createdBy ? file.name : selectedFolder.path + '/' + file.name;

		apaf.upload(absolutePath, 'newFile.bin', formdata)
		.then(function(response){
			let entry    = {"name": file.name, "type": "file", "project": project, "path": filePath, "size": file.size};
			let treeNode = currentContainerNode.tree.createTreeStructure(currentContainerNode.id + '_child_' + Math.floor(Math.random() * 100000), entry);
			currentContainerNode.addChild(treeNode);
			currentContainerNode.open();
			selectedFolder.children.push(entry);
			treeViewer.refreshTree();
			$('#wexUploadModal').hide();
			showConfirm('@apaf.workspace.explorer.upload.success', [file.name]);
		}).onError(function(msg){
			showError(msg.message ? msg.message : msg);
		});
	});
}

uploadFile = function(){
	if(!selectedFolder) return;
	$('#wexUploadInput').val('');
	$('#wexUploadModal').css('display', 'flex');
}

/* ===== Drag & drop ===== */

initDropTarget = function(target){
	var dragCounter = 0;
	target.on('dragenter.wex', function(ev){
		ev.stopPropagation();
		ev.preventDefault();
		dragCounter++;
		target.addClass('drag-over');
	});
	target.on('dragover.wex',  function(ev){ ev.stopPropagation(); ev.preventDefault(); });
	target.on('dragleave.wex', function(ev){
		dragCounter--;
		if(dragCounter <= 0){
			dragCounter = 0;
			target.removeClass('drag-over');
		}
	});
	target.on('drop.wex', function(ev){
		ev.stopPropagation();
		ev.preventDefault();
		dragCounter = 0;
		target.removeClass('drag-over');
		if(!selectedFolder) return;

		var dt    = ev.dataTransfer || ev.originalEvent.dataTransfer;
		var files = dt.files;
		if(!files || files.length == 0) return;

		var file          = files[0];
		var formdata      = new FormData();
		formdata.append("data", file);

		let project       = selectedFolder.createdBy ? selectedFolder.name : selectedFolder.project;
		let absolutePath  = selectedFolder.createdBy ? selectedFolder.name : selectedFolder.project + '/' + selectedFolder.path;
		let filePath      = selectedFolder.createdBy ? file.name : selectedFolder.path + '/' + file.name;

		apaf.upload(absolutePath, 'newFile', formdata)
		.then(function(){
			let entry    = {"name": file.name, "type": "file", "project": project, "path": filePath, "size": file.size};
			let childIdx = currentContainerNode.children.length;
			let treeNode = currentContainerNode.tree.createTreeStructure(currentContainerNode.id + '_child_' + childIdx, entry);
			currentContainerNode.addChild(treeNode);
			selectedFolder.children.push(entry);
			target.off('.wex');
			treeViewer.refreshTree();
			currentContainerNode.open();
			showConfirm('@apaf.workspace.explorer.upload.success', [file.name]);
			initDropTarget(target);
		}).onError(function(msg){
			showError(msg.message ? msg.message : msg);
			initDropTarget(target);
		});
	});
}
