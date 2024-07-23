/*
 * plugin.js - APAF login plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const md5 = require('md5');
const moment = require('moment');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_SERVICE_NAME = 'apaf-security';
const USER_DATATYPE = 'user';
const CACHE_EVICTION_LOOP_TIMEOUT = 60*1000;

var plugin = new ApafPlugin();
plugin.available = false;

plugin.beforeExtensionPlugged = function(){
	this.info('APAF Login: initializing plugin...');
	setTimeout(function(){ plugin.checkPreconditions(); },4000);
}

plugin.checkPreconditions = function(){
	this.debug('->checkPreconditions()');
	this.checkCacheLoop();
	let datatypePlugin = this.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	datatypePlugin.query(USER_DATATYPE,{"selector": {"login": {"$eq": "admin"}}},function(err,data){
		if(err){
			plugin.error('unable to query the admin user: '+JSON.stringify(err));
			plugin.debug('<-checkPreconditions()');
		}else{
			if(data && data.length==0){
				plugin.debug('user "admin" not found - creating with default parameters');
				let adminUser = {};
				adminUser.login = 'admin';
				adminUser.password = md5('admin4apaf');
				adminUser.firstname = 'Admin';
				adminUser.lastname = 'Administrator';
				adminUser.isAdmin = true;
				adminUser.domain = 'local';
				adminUser.created = moment().format('YYYY/MM/DD HH:mm:ss');
				adminUser.mail='twinxeon.no-ip@orange.fr';
				adminUser.groups = [];
				adminUser.roles = [];
				datatypePlugin.createRecord(USER_DATATYPE,adminUser,function(err,record){
					if(err){
						plugin.error('unable to create the admin user: '+JSON.stringify(err));
					}else{
						plugin.available = true;
					}
					plugin.debug('<-checkPreconditions() available='+plugin.available);
				});
			}else{
				if(data && data.length>0){
					plugin.available = true;
				}
				plugin.debug('<-checkPreconditions() available='+plugin.available);
			}
		}
	});
}

plugin.checkCacheLoop = function(){
	let cacheDataToRemove = [];
	let now = moment();
	for(var ip in this.ipCache){
		let cacheData = this.ipCache[ip];
		if(now.diff(cacheData.lastAttempt)>3*CACHE_EVICTION_LOOP_TIMEOUT){
			cacheDataToRemove.push(ip);
		}
	}
	for(var i=0;i<cacheDataToRemove.length;i++){
		let ip = cacheDataToRemove[i];
		this.debug('deleting evicted IP data from cache: '+JSON.stringify(this.ipCache[ip]));
		delete this.ipCache[ip];
	}
	setTimeout(function(){ plugin.checkCacheLoop(); },CACHE_EVICTION_LOOP_TIMEOUT);
}

plugin.authenticate = function(userId,password,then){
	this.debug('->authenticate()');
	if(this.available){
		this.debug('userId: '+userId);
		let md5Pwd = md5(password);
		this.debug('md5Pwd: '+md5Pwd);
		let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		datatypePlugin.query(USER_DATATYPE,{"selector": {"login": {"$eq": userId}}},function(err,data){
			if(err){
				plugin.debug('<-authenticate(500)');
				let errorMsg = 'error looking up for user login "'+userId+'" in database';
				plugin.error(JSON.stringify(err));
				then(errorMsg,null);
			}else{
				if(data && data.length==0){
					plugin.debug('<-authenticate(404)');
					let errorMsg = 'user login "'+userId+'" not found';
					plugin.error(errorMsg);
					then(errorMsg,null);
				}else{
					let registeredUser = data[0];
					if(registeredUser.password==md5Pwd){
						let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
						securityEngine.loadUserRoles(registeredUser,function(user){
							plugin.debug('<-authenticate(200)');
							user.password = password;
							then(null,user);
						});
					}else{
						plugin.debug('<-authenticate(401)');
						let errorMsg = 'invalid credential "'+password+'" for user '+userId;
						plugin.error(errorMsg);
						then(errorMsg,null);
					}
				}
			}
		});
	}else{
		plugin.debug('<-loginHandler(412)');
		then('Login service is currently unavailable',null);
	}
}

plugin.ipCache = {};

plugin.loginHandler = function(req,res){
	plugin.debug('->loginHandler()');
	res.set('Content-Type','application/json');
	if(plugin.available){
		let userIp = req.ip;
		plugin.debug('User IP: '+userIp);
		let userId = req.body.userid;
		let password = req.body.passwd;
		let md5Pwd = md5(password);
		if(userId && userId.length>0 && password && password.length>=6){
			//get previous login attempt from cache
			let userConnectionData = plugin.ipCache[userIp];
			let tooManyLoginAttempts = false;
			if(userConnectionData){
				if(userConnectionData.attemptCount>2){
					plugin.debug('too many login attempts detected for remote IP '+userIp);
					tooManyLoginAttempts = true;
					userConnectionData.lastAttempt = moment();
				}
			}else{
				let lastAttempt = moment();
				plugin.ipCache[userIp] = {"attemptCount": 0,"lastAttempt": lastAttempt };
				userConnectionData = plugin.ipCache[userIp];
			}
			if(!tooManyLoginAttempts){
				let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
				datatypePlugin.query(USER_DATATYPE,{"selector": {"login": {"$eq": userId}}},function(err,data){
					if(err){
						plugin.debug('<-loginHandler(500)');
						let errorMsg = 'unable to retrieve user "'+userId+'"';
						res.json({"status": 500,"message": "@apaf.page.login.error.internal","data": errorMsg});
					}else{
						if(data && data.length==0){
							lastAttempt = moment();
							userConnectionData.lastAttempt = lastAttempt;
							userConnectionData.attemptCount++;
							plugin.debug('<-loginHandler(404)');
							//res.json({"status": 404,"message": "@apaf.page.login.error.unauthorized"});
							setTimeout(function(){ res.json({"status": 404,"message": "@apaf.page.login.error.unauthorized"}); },3000);
						}else{
							let registeredUser = data[0];
							if(registeredUser.password==md5Pwd){
								userConnectionData.attemptCount = 0;
								plugin.debug('<-loginHandler(200)');
								let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
								securityEngine.loadUserRoles(registeredUser,function(user){
									plugin.debug('user:');
									plugin.debug(JSON.stringify(user,null,'\t'));
									req.session.user = user;
									req.session.user.password = password;
									let now = moment();
									req.session.lastAccess = now;
									req.session.created = now;
									req.session.alive = true;
									res.json({"status": 200,"message": "ok","data": user.roles});
								});
							}else{
								lastAttempt = moment();
								userConnectionData.lastAttempt = lastAttempt;
								userConnectionData.attemptCount++;
								plugin.debug('<-loginHandler(401)');
								//res.json({"status": 401,"message": "@apaf.page.login.error.invalid"});
								setTimeout(function(){ res.json({"status": 401,"message": "@apaf.page.login.error.invalid"}); },5000);
							}
						}
					}
				});
			}else{
				plugin.debug('<-loginHandler(423)');
				setTimeout(function(){ res.json({"status": 423,"message": "@apaf.page.login.error.tooMany"}); },userConnectionData.attemptCount*10000);
			}
		}else{
			plugin.debug('<-loginHandler(412)');
			res.json({"status": 412,"message": "@apaf.page.login.error.invalid"});
		}
	}else{
		plugin.debug('<-loginHandler(425)');
		res.json({"status": 425,"message": "@apaf.page.login.error.unavailable"});
	}
}

module.exports = plugin;