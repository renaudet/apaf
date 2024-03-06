/*
 * plugin.js - APAF logout plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';

var plugin = new ApafPlugin();

plugin.logoutHandler = function(req,res){
	plugin.debug('->logoutHandler()');
	res.set('Content-Type','application/json');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,null,function(err,user){
		if(!err){
			plugin.debug('explicit logout request from user '+user.login);
		}
		try{
			var sess = req.session;
			sess.alive = false;
			sess.save(function(err){
				if(!err){
					//sess.destroy();
					req.sessionStore.destroy(sess.id);
				}
			});
		}catch(ex){
			plugin.error('An error occurred - guess the session already expired!');
		}
		plugin.debug('<-logoutHandler(200)');
		res.redirect('/resources/html/login.html');
	});
}

module.exports = plugin;