/*
 * plugin.js - Security plugin for APAF
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const moment = require('moment');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const GROUP_DATATYPE = 'group';
const SECURITY_ROLE_DATATYPE = 'role';


var plugin = new ApafPlugin();

plugin.checkUserAccess = function(req,requiredRole,then){
	this.trace('->checkUserAccess('+requiredRole+')');
	let session = req.session;
	if(typeof session!='undefined' && session!=null){
		let user = session.user;
		if(typeof user!=undefined && user!=null && session.alive){
			session.lastAccess = moment();
			if(user.isAdmin || requiredRole==null || requiredRole.length==0 || (user.roles && typeof user.roles[requiredRole]!='undefined')){
				this.trace('<-checkUserAccess(ok)');
				then(null,user);
			}else{
				this.trace('<-checkUserAccess(unauthorized)');
				then('unauthorized',null);
			}
		}else{
			let authToken = this.checkAuthorizationToken(req);
			if(authToken!=null){
				let loginHandler = this.runtime.getPlugin('apaf.login'); // circular reference!
				loginHandler.authenticate(authToken.login,authToken.password,function(err,user){
					if(err){
						plugin.trace('<-checkUserAccess(loginHandler)');
						then(err,null);
					}else{
						if(user.isAdmin || requiredRole==null || requiredRole.length==0 || (user.roles && typeof user.roles[requiredRole]!='undefined')){
							session.user = user;
							let now = moment();
							req.session.lastAccess = now;
							req.session.created = now;
							req.session.alive = true;
							plugin.trace('<-checkUserAccess(ok)');
							then(null,user);
						}else{
							plugin.trace('<-checkUserAccess(loginHandler,unauthorized)');
							then('unauthorized',null);
						}
						
					}
				});
			}else{
				this.trace('<-checkUserAccess(unauthenticated)');
				then('unauthenticated',null);
			}
		}
	}else{
		let authToken = this.checkAuthorizationToken(req);
		if(authToken!=null){
			
		}else{
			this.trace('<-checkUserAccess(no session)');
			then('no session',null);
		}
	}
}

plugin.checkAuthorizationToken = function(req){
	if(typeof req.headers.authorization!='undefined'){
		const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
		const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
		if(login && login.length>0){
			return {"login": login,"password": password};
		}else{
			return null;
		}
	}else{
		return null;
	}
}

plugin.loadGroupRoles = function(group,then){
	let roles = [];
	let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	let loadRolesByIds = function(roleIdsList,index,next){
		if(index<roleIdsList.length){
			let roleId = roleIdsList[index];
			datatypePlugin.findByPrimaryKey(SECURITY_ROLE_DATATYPE,{"id":roleId},function(err,record){
				if(!err){
					roles.push(record);
				}
				loadRolesByIds(roleIdsList,index+1,next);
			});
		}else{
			next();
		}
	}
	loadRolesByIds(group.roles,0,function(){
		then(roles);
	})
}

plugin.loadUserRoles = function(user,then){
	let roles = {};
	let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	let loadGroupsByIds = function(groupIdsList,index,next){
		if(index<groupIdsList.length){
			let groupId = groupIdsList[index];
			datatypePlugin.findByPrimaryKey(GROUP_DATATYPE,{"id":groupId},function(err,record){
				if(err){
					loadGroupsByIds(groupIdsList,index+1,next);
				}else{
					plugin.loadGroupRoles(record,function(grouRoles){
						for(var i=0;i<grouRoles.length;i++){
							let role = grouRoles[i];
							roles[role.name] = role.id;
						}
						loadGroupsByIds(groupIdsList,index+1,next);
					});
				}
			});
		}else{
			next();
		}
	}
	loadGroupsByIds(user.groups,0,function(){
		user.roles = roles;
		plugin.trace('Security roles for user '+user.login);
		plugin.trace(JSON.stringify(roles,null,'\t'));
		then(user);
	})
}

module.exports = plugin;