/*
 * plugin.js - APAF Admin Model plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const md5 = require('md5');
const moment = require('moment');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_SERVICE_NAME = 'apaf-security';
const USER_DATATYPE = 'user';
const GROUP_DATATYPE = 'group';
const ROLE_DATATYPE = 'role';
const TIMESTAMP_FORMAT = 'YYYY/MM/DD HH:mm:ss';
const DEFAULT_LOGIN_PAGE = '/resources/html/login.html';

var plugin = new ApafPlugin();
plugin.userPrefs = {};
plugin.profilePageContributors = [];
plugin.loginPage = DEFAULT_LOGIN_PAGE;

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
	if('apaf.admin.user.preference'==extensionPointConfig.point){
		plugin.debug('adding User Preference "'+extensionPointConfig.preference+'" from #'+extenderId);
		this.userPrefs[extensionPointConfig.preference] = extensionPointConfig;
	}
	if('apaf.admin.profile.provider'==extensionPointConfig.point){
		plugin.debug('adding Profile page contributor "'+extensionPointConfig.id+'" from #'+extenderId);
		plugin.profilePageContributors.push(extensionPointConfig);
	}
	if('apaf.admin.login.page.provider'==extensionPointConfig.point){
		plugin.debug('setting Login page as "'+extensionPointConfig.url+'" from #'+extenderId);
		plugin.loginPage = extensionPointConfig.url;
	}
}

plugin.checkSessionHandler = function(req,res){
	plugin.debug('->checkSessionHandler()');
	res.set('Content-Type','application/json');
	let session = req.session;
	if(typeof session!='undefined' && session!=null && session.alive){
		let user = session.user;
		if(typeof user!=undefined && user!=null){
			plugin.debug('<-checkSessionHandler()');
			res.json({"status": 200,"message": "ok","data": user});
		}else{
			plugin.debug('<-checkSessionHandler()');
			res.json({"status": 500,"message": "unauthenticated","data": plugin.loginPage});
		}
	}else{
		plugin.debug('<-checkSessionHandler()');
		res.json({"status": 500,"message": "no session","data": plugin.loginPage});
	}
}

plugin.maintainSessionHandler = function(req,res){
	plugin.debug('->maintainSessionHandler()');
	res.set('Content-Type','application/json');
	let session = req.session;
	if(typeof session!='undefined' && session!=null && session.alive){
		let user = session.user;
		if(typeof user!=undefined && user!=null){
			session.lastAccess = moment();
			plugin.debug('<-maintainSessionHandler()');
			res.json({"status": 200,"message": "ok","data": session.lastAccess});
		}else{
			plugin.debug('<-checkSessionHandler()');
			res.json({"status": 500,"message": "unauthenticated","data": plugin.loginPage});
		}
	}else{
		plugin.debug('<-maintainSessionHandler()');
		res.json({"status": 500,"message": "no session","data": plugin.loginPage});
	}
}

plugin.queryUserHandler = function(req,res){
	plugin.debug('->queryUserHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.query.user.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryUserHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			var query = {};
			if(typeof req.body=='object'){
				query = req.body;
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-queryUserHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryUserHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.createUserHandler = function(req,res){
	plugin.debug('->createUserHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.create.user.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createUserHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			//record.password = md5(record.password);
			record.created = moment().format(TIMESTAMP_FORMAT);
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(USER_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-createUserHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createUserHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
				}
			});
		}
	});
}

plugin.updateUserHandler = function(req,res){
	plugin.debug('->updateUserHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.update.user.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateUserHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.lastUpdated = moment().format(TIMESTAMP_FORMAT);
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.updateRecord(USER_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-updateUserHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-updateUserHandler() - success');
					res.json({"status": 200,"message": "updated","data": data});
				}
			});
		}
	});
}

plugin.deleteUserHandler = function(req,res){
	plugin.debug('->deleteUserHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.delete.user.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteUserHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(USER_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-deleteUserHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteUserHandler() - success');
					res.json({"status": 200,"message": "deleted","data": data});
				}
			});
		}
	});
}

plugin.findUserHandler = function(req,res){
	plugin.debug('->findUserHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.find.user.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-findUserHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(USER_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-findUserHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-findUserHandler() - success');
					res.json({"status": 200,"message": "found","data": data});
				}
			});
		}
	});
}

plugin.queryGroupHandler = function(req,res){
	plugin.debug('->queryGroupHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.query.group.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryGroupHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			var query = {};
			if(typeof req.body=='object'){
				query = req.body;
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(GROUP_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-queryGroupHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryGroupHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.createGroupHandler = function(req,res){
	plugin.debug('->createGroupHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.create.group.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createGroupHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(GROUP_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-createGroupHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createGroupHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
				}
			});
		}
	});
}

plugin.updateGroupHandler = function(req,res){
	plugin.debug('->updateGroupHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.update.group.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateGroupHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.updateRecord(GROUP_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-updateGroupHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-updateGroupHandler() - success');
					res.json({"status": 200,"message": "updated","data": data});
				}
			});
		}
	});
}

plugin.deleteGroupHandler = function(req,res){
	plugin.debug('->deleteGroupHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.delete.group.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteGroupHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(GROUP_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-deleteGroupHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteGroupHandler() - success');
					res.json({"status": 200,"message": "deleted","data": data});
				}
			});
		}
	});
}

plugin.findGroupHandler = function(req,res){
	plugin.debug('->findGroupHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.find.group.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-findGroupHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(GROUP_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-findGroupHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-findGroupHandler() - success');
					res.json({"status": 200,"message": "found","data": data});
				}
			});
		}
	});
}

plugin.queryRoleHandler = function(req,res){
	plugin.debug('->queryRoleHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.query.role.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryRoleHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			var query = {};
			if(typeof req.body=='object'){
				query = req.body;
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(ROLE_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-queryRoleHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryRoleHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.createRoleHandler = function(req,res){
	plugin.debug('->createRoleHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.create.role.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createRoleHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(ROLE_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-createRoleHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createRoleHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
				}
			});
		}
	});
}

plugin.updateRoleHandler = function(req,res){
	plugin.debug('->updateRoleHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.update.role.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateRoleHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.updateRecord(ROLE_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-updateRoleHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-updateRoleHandler() - success');
					res.json({"status": 200,"message": "updated","data": data});
				}
			});
		}
	});
}

plugin.deleteRoleHandler = function(req,res){
	plugin.debug('->deleteRoleHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.delete.role.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteRoleHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(ROLE_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-deleteRoleHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteRoleHandler() - success');
					res.json({"status": 200,"message": "deleted","data": data});
				}
			});
		}
	});
}

plugin.findRoleHandler = function(req,res){
	plugin.debug('->findRoleHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.admin.find.role.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-findRoleHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(ROLE_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-findRoleHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-findRoleHandler() - success');
					res.json({"status": 200,"message": "found","data": data});
				}
			});
		}
	});
}

plugin.getProfileHandler = function(req,res){
	plugin.debug('->getProfileHandler()');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,null,function(err,user){
		if(err){
			plugin.debug('<-getProfileHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = user.id;
			let preferenceOnly = (req.query.preferences?'true'==req.query.preferences:false);
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(USER_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-getProfileHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-getProfileHandler() - success');
					let result = null;//Object.assign({},data);
					if(preferenceOnly){
						if(typeof data.preferences=='undefined'){
							result = {};
						}else{
							result = Object.assign({},data.preferences);
						}
					}else{
						result = Object.assign({},data);
						delete result.groups;
						//delete result.password;
						delete result['_id'];
						delete result['_rev'];
						if(typeof data.preferences=='undefined'){
							result.preferences = {};
						}
					}
					res.json({"status": 200,"message": "found","data": result});
				}
			});
		}
	});
}

plugin.updateProfileHandler = function(req,res){
	plugin.debug('->updateProfileHandler()');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,null,function(err,user){
		if(err){
			plugin.debug('<-getProfileHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let profileData = req.body;
			if(profileData.id==user.id){
				let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
				datatypePlugin.findByPrimaryKey(USER_DATATYPE,{"id": profileData.id},function(err,userRecord){
					if(err){
						plugin.debug('<-updateProfileHandler() - error');
						res.json({"status": 500,"message": err,"data": []});
					}else{
						if(profileData.firstname || profileData.lastname || profileData.mail){
							userRecord.firstname = profileData.firstname;
							userRecord.lastname = profileData.lastname;
							userRecord.mail = profileData.mail;
							if(profileData.password && profileData.password.length>0){
								userRecord.password = profileData.password;
							}
						}
						if(profileData.preferences){
							if(typeof userRecord.preferences=='undefined'){
								userRecord.preferences = {};
							}
							for(var pref in profileData.preferences){
								userRecord.preferences[pref] = profileData.preferences[pref];
							}
						}
						userRecord.lastUpdated = moment().format(TIMESTAMP_FORMAT);
						datatypePlugin.updateRecord(USER_DATATYPE,userRecord,function(err,data){
							if(err){
								plugin.debug('<-updateProfileHandler() - error');
								res.json({"status": 500,"message": err,"data": []});
							}else{
								plugin.debug('<-updateProfileHandler() - success');
								delete data.groups;
								delete data['_id'];
								delete data['_rev'];
								res.json({"status": 200,"message": "updated","data": data});
							}
						});
					}
				});
			}else{
				plugin.debug('<-updateProfileHandler() - error');
				res.json({"status": 403,"message": "Unauthorized","data": []});
			}
		}
	});
}

plugin.getPreferencesHandler = function(req,res){
	plugin.debug('->getPreferencesHandler()');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,null,function(err,user){
		if(err){
			plugin.debug('<-getPreferencesHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			plugin.debug('<-getPreferencesHandler() - success');
			res.json({"status": 200,"message": "ok","data": plugin.userPrefs });
		}
	});
}

plugin.getProfilePageContributionsHandler = function(req,res){
	plugin.debug('->getProfilePageContributionsHandler()');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,null,function(err,user){
		if(err){
			plugin.debug('<-getProfilePageContributionsHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			plugin.debug('<-getProfilePageContributionsHandler() - success');
			res.json({"status": 200,"message": "ok","data": plugin.profilePageContributors });
		}
	});
}

module.exports = plugin;