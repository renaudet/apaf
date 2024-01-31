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

var plugin = new ApafPlugin();

plugin.beforeExtensionPlugged = function(){
	plugin.info('APAF Login: initializing plugin...');
	let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	datatypePlugin.query(USER_DATATYPE,{"selector": {"login": {"$eq": "admin"}}},function(err,data){
		if(err){
			plugin.error('unable to query the admin user: '+JSON.stringify(err));
		}else{
			if(data && data.length==0){
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
					}
				});
			}
		}
	});
}

plugin.loginHandler = function(req,res){
	plugin.debug('->loginHandler()');
	res.set('Content-Type','application/json');
	let userId = req.body.userid;
	let password = req.body.passwd;
	let md5Pwd = md5(password);
	if(userId && userId.length>0 && password && password.length>=6){
		let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		datatypePlugin.query(USER_DATATYPE,{"selector": {"login": {"$eq": userId}}},function(err,data){
			if(err){
				plugin.debug('<-loginHandler(500)');
				let errorMsg = 'unable to retrieve user "'+userId+'"';
				res.json({"status": 500,"message": "@apaf.page.login.error.internal","data": errorMsg});
			}else{
				if(data && data.length==0){
					plugin.debug('<-loginHandler(404)');
					res.json({"status": 404,"message": "@apaf.page.login.error.unauthorized"});
				}else{
					let registeredUser = data[0];
					if(registeredUser.password==md5Pwd){
						plugin.debug('<-loginHandler(200)');
						let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
						securityEngine.loadUserRoles(registeredUser,function(user){
							req.session.user = user;
							req.session.user.password = password;
							res.json({"status": 200,"message": "ok","data": user.roles});
						});
					}else{
						plugin.debug('<-loginHandler(401)');
						res.json({"status": 401,"message": "@apaf.page.login.error.invalid"});
					}
				}
			}
		});
	}else{
		plugin.debug('<-loginHandler(412)');
		res.json({"status": 412,"message": "@apaf.page.login.error.invalid"});
	}
}

module.exports = plugin;