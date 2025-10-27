/*
 * plugin.js - APAF Custom Datatype Model plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_SERVICE_NAME = 'apaf-security';
const USER_DATATYPE_DATATYPE = 'datatype';
const AUDIT_SERVICE_NAME = 'audit';
const moment = require('moment');
const TIMESTAMP_FORMAT = 'YYYY/MM/DD HH:mm:ss';

var plugin = new ApafPlugin();

plugin.queryDatatypeHandler = function(req,res){
	plugin.debug('->queryDatatypeHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.query.user.datatype.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryDatatypeHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			var query = {};
			if(typeof req.body=='object'){
				query = req.body;
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-queryDatatypeHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryDatatypeHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.createDatatypeHandler = function(req,res){
	plugin.debug('->createDatatypeHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.create.user.datatype.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createDatatypeHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.createdBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(USER_DATATYPE_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-createDatatypeHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createDatatypeHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
					datatypePlugin.refreshDatatype(data);
				}
			});
		}
	});
}

plugin.updateDatatypeHandler = function(req,res){
	plugin.debug('->updateDatatypeHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.update.user.datatype.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateDatatypeHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.lastUpdatedBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.updateRecord(USER_DATATYPE_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-updateDatatypeHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-updateDatatypeHandler() - success');
					res.json({"status": 200,"message": "updated","data": data});
					datatypePlugin.refreshDatatype(data);
				}
			});
		}
	});
}

plugin.deleteDatatypeHandler = function(req,res){
	plugin.debug('->deleteDatatypeHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.delete.user.datatype.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteDatatypeHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(USER_DATATYPE_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-deleteDatatypeHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteDatatypeHandler() - success');
					res.json({"status": 200,"message": "deleted","data": data.record});
					datatypePlugin.refreshDatatype(data.record,true);
				}
			});
		}
	});
}

plugin.findDatatypeByPrimaryKeyHandler = function(req,res){
	plugin.debug('->findDatatypeByPrimaryKeyHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.find.user.datatype.by.id.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-findDatatypeByPrimaryKeyHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(USER_DATATYPE_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-findDatatypeByPrimaryKeyHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-findDatatypeByPrimaryKeyHandler() - success');
					res.json({"status": 200,"message": "found","data": data});
				}
			});
		}
	});
}

plugin.findDatatypeByNameHandler = function(req,res){
	plugin.debug('->findDatatypeByNameHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.find.user.datatype.by.name.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-findDatatypeByNameHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypeName = req.query.name;
			if(typeof datatypeName=='undefined' || datatypeName.length==0){
				plugin.debug('<-findDatatypeByNameHandler() - error invalid name');
				res.json({"status": 406,"message": "Not Acceptable","data": "No datatype name found in request"});
			}else{
				let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
				datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatypeName}}},function(err,data){
					if(err){
						plugin.debug('<-findDatatypeByNameHandler() - error');
						res.json({"status": 500,"message": err,"data": []});
					}else{
						if(data && data.length>0){
							let datatypeRecord = data[0];
							plugin.debug('<-findDatatypeByNameHandler() - success');
							res.json({"status": 200,"message": "found","data": datatypeRecord});
						}else{
							plugin.debug('<-findDatatypeByNameHandler() - error');
							res.json({"status": 404,"message": "Not Found"});
						}
					}
				});
			}
		}
	});
}

plugin.queryUserDataHandler = function(req,res){
	plugin.debug('->queryUserDataHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.query.user.data.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryUserDataHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypeName = req.params.datatypeName;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatypeName}}},function(err,data){
				if(err){
					plugin.debug('<-queryUserDataHandler() - error datatype');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data && data.length>0){
						let datatypeRecord = data[0];
						if(user.isAdmin || datatypeRecord.readRole.length==0 ||
						   typeof user.roles[datatypeRecord.readRole]!='undefined'){
							let selector = {};
							if(req.body && typeof req.body=='object' && req.body.selector){
								selector = req.body;
							}
							datatypePlugin.query(datatypeRecord.name,selector,function(err,data){
								if(err){
									plugin.debug('<-queryUserDataHandler() - error database');
									res.json({"status": 500,"message": err,"data": []});
								}else{
									let result = [];
									if(datatypeRecord.private && !user.isAdmin){
										for(var i=0;i<data.length;i++){
											let item = data[i];
											if(item['createdBy']==user.login){
												result.push(item);
											}
										}
									}else{
										result = data;
									}
									plugin.debug('<-queryUserDataHandler() - success');
									res.json({"status": 200,"message": "found","data": result});
								}
							});
						}else{
							plugin.debug('<-queryUserDataHandler() - error unauthorized');
							plugin.debug('datatype:');
							plugin.debug(JSON.stringify(datatypeRecord,null,'\t'));
							plugin.debug('user:');
							plugin.debug(JSON.stringify(user,null,'\t'));
							res.json({"status": 401,"message": "unauthorized","data": []});
						}
					}else{
						plugin.debug('<-queryUserDataHandler() - error not found');
						let msg = 'datatype '+datatypeName+' not found';
						res.json({"status": 404,"message": "Not Found","data": msg});
					}
				}
			});
		}
	});
}

plugin.createUserDataHandler = function(req,res){
	plugin.debug('->createUserDataHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.create.user.data.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	let auditService = plugin.getService(AUDIT_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createUserDataHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypeName = req.params.datatypeName;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatypeName}}},function(err,data){
				if(err){
					plugin.debug('<-createUserDataHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data && data.length>0){
						let datatypeRecord = data[0];
						if(user.isAdmin || datatypeRecord.writeRole.length==0 ||
						   typeof user.roles[datatypeRecord.writeRole]!='undefined'){
							let record = req.body;
							record['createdBy'] = user.login;
							record['created'] = moment().format(TIMESTAMP_FORMAT);
							datatypePlugin.createRecord(datatypeRecord.name,record,function(err,data){
								if(err){
									plugin.debug('<-createUserDataHandler() - error');
									res.json({"status": 500,"message": err,"data": []});
								}else{
									if(datatypeRecord.auditEnabled){
										try{
											auditService.createAuditRecord(datatypeRecord,data.id,user.login,'created',data);
										}catch(e){}
									}
									plugin.debug('<-createUserDataHandler() - success');
									res.json({"status": 200,"message": "created","data": data});
								}
							});
						}else{
							plugin.debug('<-createUserDataHandler() - error');
							res.json({"status": 401,"message": "unauthorized","data": []});
						}
					}else{
						plugin.debug('<-createUserDataHandler() - error');
						let msg = 'datatype '+datatypeName+' not found';
						res.json({"status": 404,"message": "Not Found","data": msg});
					}
				}
			});
		}
	});
}

plugin.updateUserDataHandler = function(req,res){
	plugin.debug('->updateUserDataHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.update.user.data.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	let auditService = plugin.getService(AUDIT_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateUserDataHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypeName = req.params.datatypeName;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatypeName}}},function(err,data){
				if(err){
					plugin.debug('<-updateUserDataHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data && data.length>0){
						let datatypeRecord = data[0];
						if(user.isAdmin || datatypeRecord.writeRole.length==0 ||
						   typeof user.roles[datatypeRecord.writeRole]!='undefined'){
							datatypePlugin.updateRecord(datatypeRecord.name,req.body,function(err,data){
								if(err){
									plugin.debug('<-updateUserDataHandler() - error');
									res.json({"status": 500,"message": err,"data": []});
								}else{
									if(datatypeRecord.auditEnabled){
										try{
											auditService.createAuditRecord(datatypeRecord,req.body.id,user.login,'updated',req.body);
										}catch(e){}
									}
									plugin.debug('<-updateUserDataHandler() - success');
									res.json({"status": 200,"message": "updated","data": data});
								}
							});
						}else{
							plugin.debug('<-updateUserDataHandler() - error');
							res.json({"status": 401,"message": "unauthorized","data": []});
						}
					}else{
						plugin.debug('<-updateUserDataHandler() - error');
						let msg = 'datatype '+datatypeName+' not found';
						res.json({"status": 404,"message": "Not Found","data": msg});
					}
				}
			});
		}
	});
}

plugin.deleteUserDataHandler = function(req,res){
	plugin.debug('->deleteUserDataHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.delete.user.data.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	let auditService = plugin.getService(AUDIT_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteUserDataHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypeName = req.params.datatypeName;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatypeName}}},function(err,data){
				if(err){
					plugin.debug('<-deleteUserDataHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data && data.length>0){
						let datatypeRecord = data[0];
						if(user.isAdmin || datatypeRecord.deleteRole.length==0 ||
						   typeof user.roles[datatypeRecord.deleteRole]!='undefined'){
							let id = req.params.id;
							datatypePlugin.deleteRecord(datatypeRecord.name,{"id": id},function(err,data){
								if(err){
									plugin.debug('<-deleteUserDataHandler() - error');
									res.json({"status": 500,"message": err,"data": []});
								}else{
									if(datatypeRecord.auditEnabled){
										try{
											auditService.createAuditRecord(datatypeRecord,id,user.login,'deleted');
										}catch(e){}
									}
									plugin.debug('<-deleteUserDataHandler() - success');
									res.json({"status": 200,"message": "updated","data": data});
								}
							});
						}else{
							plugin.debug('<-deleteUserDataHandler() - error');
							res.json({"status": 401,"message": "unauthorized","data": []});
						}
					}else{
						plugin.debug('<-deleteUserDataHandler() - error');
						let msg = 'datatype '+datatypeName+' not found';
						res.json({"status": 404,"message": "Not Found","data": msg});
					}
				}
			});
		}
	});
}

plugin.getUserDataByIdHandler = function(req,res){
	plugin.debug('->getUserDataByIdHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.get.user.data.by.id.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getUserDataByIdHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypeName = req.params.datatypeName;
			let id = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatypeName}}},function(err,data){
				if(err){
					plugin.debug('<-getUserDataByIdHandler() - error datatype');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data && data.length>0){
						let datatypeRecord = data[0];
						if(user.isAdmin || datatypeRecord.readRole.length==0 ||
						   typeof user.roles[datatypeRecord.readRole]!='undefined'){
							datatypePlugin.findByPrimaryKey(datatypeRecord.name,{"id": id},function(err,record){
								if(err){
									plugin.debug('<-getUserDataByIdHandler() - error database');
									res.json({"status": 500,"message": err,"data": []});
								}else{
									if(!datatypeRecord.private || user.isAdmin || record['createdBy']==user.login){
										plugin.debug('<-getUserDataByIdHandler() - success');
										res.json({"status": 200,"message": "found","data": record});
									}else{
										plugin.debug('<-getUserDataByIdHandler() - private');
										res.json({"status": 404,"message": "Not Found","data": {}});
									}
								}
							});
						}else{
							plugin.debug('<-getUserDataByIdHandler() - error unauthorized');
							plugin.debug('datatype:');
							plugin.debug(JSON.stringify(datatypeRecord,null,'\t'));
							plugin.debug('user:');
							plugin.debug(JSON.stringify(user,null,'\t'));
							res.json({"status": 401,"message": "unauthorized","data": []});
						}
					}else{
						plugin.debug('<-getUserDataByIdHandler() - error not found');
						let msg = 'datatype '+datatypeName+' not found';
						res.json({"status": 404,"message": "Not Found","data": msg});
					}
				}
			});
		}
	});
}

module.exports = plugin;