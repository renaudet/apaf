/*
 * plugin.js - APAF logs management plugin
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const NPA_LOGGIN_PLUGIN_ID = 'npa.logging';

var plugin = new ApafPlugin();

plugin.getLoggersHandler = function(req,res){
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.logs.query.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let loggingPlugin = plugin.runtime.getPlugin(NPA_LOGGIN_PLUGIN_ID);
			res.json({"status": 200,"message": "ok","data": loggingPlugin.getLoggingPlugins()});
		}
	});
}

plugin.getLogLevelHandler = function(req,res){
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.logs.query.plugin.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let pluginId = req.params.id;
			let loggingPlugin = plugin.runtime.getPlugin(NPA_LOGGIN_PLUGIN_ID);
			res.json({"status": 200,"message": "ok","data": loggingPlugin.getLogLevel(pluginId)});
		}
	});
}

module.exports = plugin;