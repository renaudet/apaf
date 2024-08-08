/*
 * plugin.js - APAF APIs managing plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const HTTP_SERVICE_NAME = 'http';

var plugin = new ApafPlugin();

plugin.getApisHandler = function(req,res){
	plugin.debug('->getApisHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.apis.query.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getApisHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let httpService = plugin.getService(HTTP_SERVICE_NAME);
			plugin.debug('<-getApisHandler() - success');
			res.json({"status": 200,"message": "ok","data": httpService.providers});
		}
	});
}

module.exports = plugin;