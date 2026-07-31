/*
 * plugin.js - APAF workspace & filesystem managing plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const formidable = require('formidable');
const moment = require('moment');
const SECURITY_SERVICE_NAME = 'apaf-security';
const WORKSPACE_SERVICE_NAME = 'workspace';

var plugin = new ApafPlugin();

plugin._emitUploadedEvent = function(workspaceService, projectName, filePath){
	try{
		let content = workspaceService.getFileContent(filePath, {"encoding": "base64"});
		let npaWorkspace = plugin.runtime.getPlugin('npa.workspace');
		npaWorkspace._emitWorkspaceEvent('workspace.file.uploaded',{"project": projectName,"path": filePath,"content": content});
	}catch(e){
		plugin.debug('_emitUploadedEvent: could not read file "'+filePath+'": '+e.message);
	}
}

plugin.createProjectHandler = function(req,res){
	plugin.debug('->createProjectHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workspace.project.create.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createProjectHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let projectInfo = req.body;
			if(typeof projectInfo.name=='undefined'){
				projectInfo.name = 'New Project';
			}
			if(typeof projectInfo.displayName=='undefined'){
				projectInfo.displayName = 'New Project';
			}
			if(typeof projectInfo.type=='undefined'){
				projectInfo.type = 'general';
			}
			// shared projects are owned by 'system' so all users can see them
			projectInfo.createdBy = (projectInfo.type === 'shared') ? 'system' : user.login;
			projectInfo.created = moment().format('YYYY/MM/DD HH:mm:ss');
			let workspaceService = plugin.getService(WORKSPACE_SERVICE_NAME);
			workspaceService.createProject(projectInfo);
			plugin.debug('<-createProjectHandler()');
			res.json({"status": 200,"message": "Ok","data": projectInfo});
		}
	});
}

plugin.findProjectHandler = function(req,res){
	plugin.debug('->findProjectHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workspace.project.find.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-findProjectHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let filter = req.body;
			let workspaceService = plugin.getService(WORKSPACE_SERVICE_NAME);
			let projects = workspaceService.getProjects(filter);
			if(!user.isAdmin){
				// non-admin users see their own projects + all shared ('system') projects
				projects = projects.filter(p => p.createdBy==user.login || p.createdBy=='system');
			}
			plugin.debug('<-findProjectHandler()');
			res.json({"status": 200,"message": "Ok","data": projects});
		}
	});
}

plugin.createFolderHandler = function(req,res){
	plugin.debug('->createFolderHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workspace.folder.create.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createFolderHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let folderCreationContext = req.body;
			if(folderCreationContext.project && folderCreationContext.project.length>0 &&
			   folderCreationContext.folder && folderCreationContext.folder.length>0){
				plugin.debug('project: '+folderCreationContext.project);
				plugin.debug('folder: '+folderCreationContext.folder);
				let workspaceService = plugin.getService(WORKSPACE_SERVICE_NAME);
				let project = workspaceService.getProject(folderCreationContext.project);
				if(project==null){
					plugin.debug('<-createFolderHandler() - project not found');
					res.json({"status": 404,"message": "Not found","data": "Project not found"});
					return;
				}
				if(!user.isAdmin && user.login!=project.createdBy && project.createdBy!='system'){
					plugin.debug('<-createFolderHandler() - forbidden');
					res.json({"status": 403,"message": "Forbidden","data": "Not owner"});
					return;
				}
				let creationOutput = workspaceService.createFolder(folderCreationContext.project,folderCreationContext.folder);
				plugin.debug('<-createFolderHandler()');
				res.json({"status": 200,"message": "Ok","data": creationOutput});
			}else{
				plugin.debug('<-createFolderHandler() bad request');
				res.json({"status": 406,"message": "Not acceptable","data": "Bad folder creation context"});
			}
		}
	});
}

plugin.readFolderContentHandler = function(req,res){
	plugin.debug('->readFolderContentHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workspace.folder.read.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-readFolderContentHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let project = req.query.project;
			let folder = req.query.folder;
			let showHidden = ('true'==req.query.hidden);
			if(project && project.length>0){
				if(typeof folder=='undefined' || folder==null){
					folder = '';
				}
				let relativPath = project+'/'+folder;
				let workspaceService = plugin.getService(WORKSPACE_SERVICE_NAME);
				let content = workspaceService.folderContent(relativPath,showHidden);
				plugin.debug('<-readFolderContentHandler()');
				res.json({"status": 200,"message": "Ok","data": content});
			}else{
				plugin.debug('<-readFolderContentHandler() bad request');
				res.json({"status": 406,"message": "Not acceptable","data": "Bad folder reading context"});
			}
		}
	});
}

plugin.readFileContentHandler = function(req,res){
	plugin.debug('->readFileContentHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workspace.file.read.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-readFileContentHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let encryptedData = req.params.encrypted;
			if(encryptedData && encryptedData.length>0){
				let buff = Buffer.from(encryptedData, 'base64');
				let filePath = buff.toString('ascii');
				let workspaceService = plugin.getService(WORKSPACE_SERVICE_NAME);
				let content = workspaceService.getFileContent(filePath);
				plugin.debug('<-readFileContentHandler()');
				res.json({"status": 200,"message": "Ok","data": content});
			}else{
				plugin.debug('<-readFileContentHandler() bad request');
				res.json({"status": 406,"message": "Not acceptable","data": "No path data received!"});
			}
		}
	});
}

plugin.writeFileHandler = function(req,res){
	plugin.debug('->writeFileHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workspace.file.write.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-writeFileHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let encryptedData = req.params.encrypted;
			if(encryptedData && encryptedData.length>0){
				let buff = Buffer.from(encryptedData, 'base64');
				let filePath = buff.toString('ascii');
				let projectName = filePath.split('/')[0];
				let workspaceService = plugin.getService(WORKSPACE_SERVICE_NAME);
				let project = workspaceService.getProject(projectName);
				if(project==null){
					plugin.debug('<-writeFileHandler() - project not found');
					res.json({"status": 404,"message": "Not found","data": "Project not found"});
					return;
				}
				if(!user.isAdmin && user.login!=project.createdBy && project.createdBy!='system'){
						plugin.debug('<-writeFileHandler() - forbidden');
						res.json({"status": 403,"message": "Forbidden","data": "Not owner"});
						return;
					}
				let fileContent, writeOptions = {};
					if(Buffer.isBuffer(req.body)){
						// binary sync path: bodyParser.raw produced a Buffer
						fileContent = req.body;
						writeOptions.encoding = 'binary';
						plugin.debug('writeFileHandler: binary path, bufferLen='+fileContent.length);
					}else if(typeof req.body === 'object' && req.body !== null){
						// JSON sync path (MCP or sharing plugin text files)
						fileContent = req.body.content;
						if(req.body.encoding){ writeOptions.encoding = req.body.encoding; }
						plugin.debug('writeFileHandler: object path, encoding='+writeOptions.encoding+' contentLen='+(fileContent?fileContent.length:0));
					}else{
						// UI path: raw string via bodyParser.text
						fileContent = req.body;
						plugin.debug('writeFileHandler: string path, bodyLen='+(fileContent?fileContent.length:0));
					}
					workspaceService.setFileContent(filePath,fileContent,writeOptions);
				plugin.debug('<-writeFileHandler()');
				res.json({"status": 200,"message": "Ok","data": []});
			}else{
				plugin.debug('<-writeFileHandler() bad request');
				res.json({"status": 406,"message": "Not acceptable","data": "No path data received!"});
			}
		}
	});
}

plugin.deleteResourceHandler = function(req,res){
	plugin.debug('->deleteResourceHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workspace.delete.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteResourceHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let encryptedData = req.params.encrypted;
			if(encryptedData && encryptedData.length>0){
				let buff = Buffer.from(encryptedData, 'base64');
				let resourcePath = buff.toString('ascii');
				let workspaceService = plugin.getService(WORKSPACE_SERVICE_NAME);
				if(resourcePath.indexOf('/')>=0){
					// folder or file — check ownership on the parent project
					let projectName = resourcePath.split('/')[0];
					let project = workspaceService.getProject(projectName);
					if(project==null){
						plugin.debug('<-deleteResourceHandler() - project not found');
						res.json({"status": 404,"message": "Not found","data": "Project not found"});
						return;
					}
					if(!user.isAdmin && user.login!=project.createdBy){
						plugin.debug('<-deleteResourceHandler() - forbidden');
						res.json({"status": 403,"message": "Forbidden","data": "Not owner"});
						return;
					}
					try{
						workspaceService.deleteResource(resourcePath);
						plugin.debug('<-deleteResourceHandler()');
						res.json({"status": 200,"message": "Deleted","data": []});
					}catch(e){
						plugin.error(e.message);
						plugin.debug('<-deleteResourceHandler() - error deleting resource');
						res.json({"status": 500,"message": e.message,"data": []});
					}
				}else{
					// project deletion — ownership check done inside npa.workspace.deleteProject()
					try{
						workspaceService.deleteProject(resourcePath,user);
						plugin.debug('<-deleteResourceHandler()');
						res.json({"status": 200,"message": "Deleted","data": []});
					}catch(e){
						plugin.error(e.message);
						plugin.debug('<-deleteResourceHandler() - error deleting project');
						res.json({"status": 500,"message": e.message,"data": []});
					}
				}
			}else{
				plugin.debug('<-deleteResourceHandler() bad request');
				res.json({"status": 406,"message": "Not acceptable","data": "No resource path received!"});
			}
		}
	});
}

plugin.uploadFileHandler = function(req,res){
	plugin.debug('->uploadFileHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workspace.file.upload.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-uploadFileHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let encryptedData = req.params.encrypted;
			if(encryptedData && encryptedData.length>0){
				let buff = Buffer.from(encryptedData, 'base64');
				let folder = buff.toString('ascii');
				plugin.debug('folder: '+folder);
				let projectName = folder.split('/')[0];
				let workspaceService = plugin.getService(WORKSPACE_SERVICE_NAME);
				let project = workspaceService.getProject(projectName);
				if(project==null){
					plugin.debug('<-uploadFileHandler() - project not found');
					res.json({"status": 404,"message": "Not found","data": "Project not found"});
					return;
				}
				if(!user.isAdmin && user.login!=project.createdBy && project.createdBy!='system'){
						plugin.debug('<-uploadFileHandler() - forbidden');
						res.json({"status": 403,"message": "Forbidden","data": "Not owner"});
						return;
					}
				let uploadDir = workspaceService.absolutePath(folder);
				plugin.debug('uploadDir: '+uploadDir);
				workspaceService.checkExists(uploadDir);
				const form = formidable({ "multiples": false, "uploadDir": uploadDir });
					form.parse(req, function(err, fields, files){
						if(err){
							plugin.debug('<-uploadFileHandler() - request parsing error');
							plugin.debug('err: '+JSON.stringify(err));
							res.json({"status": 406,"message": err,"data": []});
						}else{
							let emitted = false;
								for(var entry in files){
									var file = files[entry];
									workspaceService.renameFile(uploadDir,file.newFilename,file.originalFilename);
									if(!emitted){
										let filePath = folder+'/'+file.originalFilename;
										plugin._emitUploadedEvent(workspaceService, projectName, filePath);
										emitted = true;
									}
								}
							plugin.debug('<-uploadFileHandler()');
							res.json({"status": 200,"message": "Uploaded","data": file.originalFilename});
						}
					});
			}else{
				plugin.debug('<-uploadFileHandler() - bad request');
				res.json({"status": 406,"message": "Not acceptable","data": "No resource path received!"});
			}
		}
	});
}

plugin.readBinaryFileContentHandler = function(req,res){
	plugin.debug('->readBinaryFileContentHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.workspace.file.read.binary.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-readBinaryFileContentHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let encryptedData = req.params.encrypted;
			if(encryptedData && encryptedData.length>0){
				let buff = Buffer.from(encryptedData, 'base64');
				let filePath = buff.toString('ascii');
				plugin.debug('received request for file '+filePath);
				if(filePath.lastIndexOf('/')>=0){
					let filename = filePath.substring(filePath.lastIndexOf('/')+1);
					plugin.debug('filename is '+filename);
					let workspaceService = plugin.getService(WORKSPACE_SERVICE_NAME);
					let absoluteFilePath = workspaceService.absolutePath(filePath); 
					plugin.debug('absoluteFilePath is '+absoluteFilePath);
					plugin.debug('<-readBinaryFileContentHandler() sending file '+filePath);
					res.download(absoluteFilePath, filename); 
				}else{
					plugin.debug('<-readBinaryFileContentHandler() bad request');
					res.json({"status": 406,"message": "Not acceptable","data": "Invalid path data received!"});
				}
			}else{
				plugin.debug('<-readBinaryFileContentHandler() bad request');
				res.json({"status": 406,"message": "Not acceptable","data": "No path data received!"});
			}
		}
	});
}

module.exports = plugin;