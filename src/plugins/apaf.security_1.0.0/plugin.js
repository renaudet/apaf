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
		if(typeof user!=undefined && user!=null){
			session.lastAccess = moment();
			if(user.isAdmin || requiredRole==null || requiredRole.length==0 || (user.roles && typeof user.roles[requiredRole]!='undefined')){
				this.trace('<-checkUserAccess(ok)');
				then(null,user);
			}else{
				this.trace('<-checkUserAccess(unauthorized)');
				then('unauthorized',null);
			}
		}else{
			this.trace('<-checkUserAccess(unauthenticated)');
			then('unauthenticated',null);
		}
	}else{
		this.trace('<-checkUserAccess(no session)');
		then('no session',null);
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