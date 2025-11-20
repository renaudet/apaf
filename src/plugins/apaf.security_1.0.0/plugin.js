/*
 * plugin.js - Security plugin for APAF
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const moment = require('moment');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const GROUP_DATATYPE = 'group';
const SECURITY_ROLE_DATATYPE = 'role';
const SECURITY_TOKEN_URI_PARAM_NAME = 'token';
const CRYPTOGRAPHY_SERVICE_NAME = 'cryptography';
const USER_SESSION_DATA_NAMESPACE = '_user_data';
const TELEMETRY_SERVICE_NAME = 'telemetry';
const SECURE_API_CALL_DIMENSION = 'secure.api.call';
const TELEMETRY_COLLECT_TIMEOUT = 30;


var plugin = new ApafPlugin();
plugin.invocationCount = 0;

plugin.onConfigurationLoaded = function(){
	setTimeout(function(){ plugin.collectTelemetry(); },10*1000);
}

plugin.checkUserAccess = function(req,requiredRole,then){
	this.trace('->checkUserAccess('+requiredRole+')');
	let session = req.session;
	if(typeof session!='undefined' && session!=null){
		this.invocationCount++;
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
							req.session[USER_SESSION_DATA_NAMESPACE] = {"_created": now};
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
	this.trace('->checkAuthorizationToken()');
	if(typeof req.headers.authorization!='undefined'){
		this.debug('Authorization header: '+req.headers.authorization);
		let authorization = req.headers.authorization;
		if(authorization.startsWith('Basic ')){
			const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
			const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
			if(login && login.length>0){
				this.trace('->checkAuthorizationToken() Basic token found');
				return {"login": login,"password": password};
			}else{
				this.trace('->checkAuthorizationToken() invalid token for Basic auth');
				return null;
			}
		}else
		if(authorization.startsWith('Bearer ')){
			const token = (req.headers.authorization || '').split(' ')[1] || '';
			let cryptoService = this.getService(CRYPTOGRAPHY_SERVICE_NAME);
			let decrypted = cryptoService.decrypt(token).split(':');
			if(decrypted && decrypted.length==3){
				let login = decrypted[0];
				let password = decrypted[1];
				let uri = decrypted[2];
				let path = req.baseUrl+req.path;
				if(uri==path){
					this.trace('->checkAuthorizationToken() valid Bearer token found');
					return {"login": login,"password": password};
				}else{
					this.trace('->checkAuthorizationToken() invalid Bearer token for path '+path);
					return null;
				}
			}else{
				this.trace('->checkAuthorizationToken() invalid Bearer token');
				return null;
			}
		}else{
			this.trace('->checkAuthorizationToken() unsupported auth method detected');
			return null;
		}
	}else{
		if(typeof req.query[SECURITY_TOKEN_URI_PARAM_NAME]!='undefined' && req.query[SECURITY_TOKEN_URI_PARAM_NAME].length>0){
			this.trace('Security token found');
			let token = req.query[SECURITY_TOKEN_URI_PARAM_NAME];
			let cryptoService = this.getService(CRYPTOGRAPHY_SERVICE_NAME);
			let decrypted = cryptoService.decrypt(token).split(':');
			if(decrypted && decrypted.length==3){
				let login = decrypted[0];
				let password = decrypted[1];
				let uri = decrypted[2];
				let path = req.baseUrl+req.path;
				if(uri==path){
					this.trace('->checkAuthorizationToken() valid query parameter token found');
					return {"login": login,"password": password};
				}else{
					this.trace('->checkAuthorizationToken() invalid query parameter token for path '+path);
					return null;
				}
			}else{
				this.trace('->checkAuthorizationToken() invalid query parameter token');
				return null;
			}
		}else
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

plugin.collectTelemetry = function(){
	this.trace('->collectTelemetry()');
	let telemetryService = this.getService(TELEMETRY_SERVICE_NAME);
	let telemetryData = {"timestamp": moment().format('YYYY/MM/DD HH:mm:ss'),"count": this.invocationCount};
	telemetryService.push(SECURE_API_CALL_DIMENSION,telemetryData);
	plugin.trace('<-collectTelemetry()');
	setTimeout(function(){ plugin.collectTelemetry(); },TELEMETRY_COLLECT_TIMEOUT*1000);
}

module.exports = plugin;