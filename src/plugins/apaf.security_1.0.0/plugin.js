/*
 * plugin.js - Security plugin for APAF
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const moment = require('moment');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const USER_DATATYPE = 'user';
const GROUP_DATATYPE = 'group';
const SECURITY_ROLE_DATATYPE = 'role';
const SECURITY_TOKEN_URI_PARAM_NAME = 'token';
const CRYPTOGRAPHY_SERVICE_NAME = 'cryptography';
const USER_SESSION_DATA_NAMESPACE = '_user_data';
const TELEMETRY_SERVICE_NAME = 'telemetry';
const SECURE_API_CALL_DIMENSION = 'secure.api.call';
const TELEMETRY_COLLECT_TIMEOUT = 30;
const API_KEY_HEADER = 'x-api-key';
const BASE_API_KEY_VALUE = 'APAF_';


var plugin = new ApafPlugin();
plugin.invocationCount = 0;

plugin.onConfigurationLoaded = function(){
	setTimeout(function(){ plugin.collectTelemetry(); },10*1000);
}

plugin.checkUserAccess = function(req,requiredRole,then){
	this.trace('->checkUserAccess('+requiredRole+')');
	let session = req.session;
	if(typeof session!='undefined' && session!=null){
		this.debug('an existing session was found');
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
			this.debug('this is a technical session - check headers for a valid credential...');
			this.checkAuthorizationToken(req,function(credential){
				if(credential!=null){
					if(credential.user){
						let user = credential.user;
						if(user.isAdmin || requiredRole==null || requiredRole.length==0 || (user.roles && typeof user.roles[requiredRole]!='undefined')){
							plugin.trace('<-checkUserAccess(ok)');
							then(null,user);
						}else{
							plugin.trace('<-checkUserAccess(unauthorized)');
							then('unauthorized',null);
						}
					}else{
						let loginHandler = plugin.runtime.getPlugin('apaf.login'); // circular reference!
						loginHandler.authenticate(credential.login,credential.password,function(err,user){
							if(err){
								plugin.trace('<-checkUserAccess(loginHandler) error');
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
					}
				}else{
					plugin.trace('<-checkUserAccess(unauthenticated)');
					then('unauthenticated',null);
				}
			});
		}
	}else{
		this.debug('no existing session was found - check headers for a valid credential');
		this.checkAuthorizationToken(req,function(credential){
			if(credential!=null){
				if(credential.user){
					let user = credential.user;
					if(user.isAdmin || requiredRole==null || requiredRole.length==0 || (user.roles && typeof user.roles[requiredRole]!='undefined')){
						plugin.trace('<-checkUserAccess(ok)');
						then(null,user);
					}else{
						plugin.trace('<-checkUserAccess(unauthorized)');
						then('unauthorized',null);
					}
				}else{
					let loginHandler = this.runtime.getPlugin('apaf.login'); // circular reference!
					loginHandler.authenticate(credential.login,credential.password,function(err,user){
						if(err){
							plugin.trace('<-checkUserAccess(loginHandler)');
							then(err,null);
						}else{
							if(user.isAdmin || requiredRole==null || requiredRole.length==0 || (user.roles && typeof user.roles[requiredRole]!='undefined')){
								plugin.trace('<-checkUserAccess() success - valid token only');
								then(null,user);
							}else{
								plugin.trace('<-checkUserAccess(loginHandler,unauthorized)');
								then('unauthorized',null);
							}
						}
					});
				}
			}else{
				plugin.trace('<-checkUserAccess(no session)');
				then('no session',null);
			}
		});
	}
}

plugin.checkAuthorizationToken = function(req,then){
	this.trace('->checkAuthorizationToken()');
	this.debug('checkAuthorizationToken() - headers: '+JSON.stringify(req.headers));
	if(typeof req.headers.authorization!='undefined'){
		this.debug('Authorization header: '+req.headers.authorization);
		let authorization = req.headers.authorization;
		if(authorization.startsWith('Basic ')){
			const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
			const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
			if(login && login.length>0){
				this.trace('->checkAuthorizationToken() Basic token found');
				this.trace('login: '+login);
				then({"login": login,"password": password});
			}else{
				this.trace('->checkAuthorizationToken() invalid token for Basic auth');
				then(null);
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
					this.trace('login: '+login);
					this.trace('uri: '+uri);
					then({"login": login,"password": password});
				}else{
					this.trace('->checkAuthorizationToken() unauthorized Bearer token for path '+path);
					this.trace('login: '+login);
					this.trace('uri: '+uri);
					then(null);
				}
			}else{
				this.trace('->checkAuthorizationToken() invalid Bearer token');
				then(null);
			}
		}else{
			this.trace('->checkAuthorizationToken() unsupported auth method detected');
			then(null);
		}
	}else if(typeof req.headers[API_KEY_HEADER]!='undefined'){
		this.debug('checkAuthorizationToken() - x-api-key branch entered');
	   	let apiKey = req.headers[API_KEY_HEADER];
		const [userid, authorizationKey] = Buffer.from(apiKey, 'base64').toString().split(':');
		this.debug('checkAuthorizationToken() - userid: '+userid);
		if(userid && userid.length>0){
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE,{"selector": {"login": {"$eq": userid}}},function(err,userQueryResult){
				if(err){
					plugin.trace('->checkAuthorizationToken() error accessing the user base');
					then(null);
				}else{
					if(userQueryResult && userQueryResult.length==1){
						let apiUser = userQueryResult[0];
						if(apiUser.apiKey==authorizationKey){
							plugin.trace('->checkAuthorizationToken() valid API key found for user '+apiUser.login);
							plugin.loadUserRoles(apiUser,function(user){
								then({"user": user});
							});
						}else{
							plugin.trace('->checkAuthorizationToken() expired data');
							then(null);
						}
					}else{
						plugin.trace('->checkAuthorizationToken() unknown user');
						then(null);
					}
				}
			});
		}else{
			this.trace('->checkAuthorizationToken() invalid API Key provided');
			then(null);
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
					this.trace('->checkAuthorizationToken() valid query parameter token found for user '+login);
					then({"login": login,"password": password});
				}else{
					this.trace('->checkAuthorizationToken() unauthorized query parameter token for path '+path);
					then(null);
				}
			}else{
				this.trace('->checkAuthorizationToken() invalid query parameter token');
				then(null);
			}
		}else
			then(null);
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

plugin.generateApiKeyHandler = function(req,res){
	plugin.debug('->generateApiKeyHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.security.generate.api.key.handler');
	plugin.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-generateApiKeyHandler() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let authorizationKey = BASE_API_KEY_VALUE+moment().valueOf();
			let cryptoService = plugin.getService(CRYPTOGRAPHY_SERVICE_NAME);
			let encrypted = cryptoService.encrypt(authorizationKey);
			plugin.debug('<-generateApiKeyHandler() key='+encrypted);
			res.json({"status": 200,"message": "ok","data": {"key": encrypted}});
		}
	});
}

module.exports = plugin;