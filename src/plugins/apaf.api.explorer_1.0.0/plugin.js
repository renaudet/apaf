/*
 * plugin.js - APAF API Explorer plugin for NPA
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const REMOTE_CONTEXT_PROVIDER_EXTENSION_POINT = 'apaf.remote.context.provider';

var plugin = new ApafPlugin();

plugin.getRemoteProvidersHandler = function(req, res){
	plugin.debug('->getRemoteProvidersHandler()');
	res.set('Content-Type', 'application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.api.explorer.remote.providers.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req, requiredRole, function(err, user){
		if(err){
			plugin.debug('<-getRemoteProvidersHandler() - error access');
			res.json({"status": 500, "message": err, "data": []});
		}else{
			let providers = plugin.getExtensionsForPoint(REMOTE_CONTEXT_PROVIDER_EXTENSION_POINT);
			plugin.debug('<-getRemoteProvidersHandler() - '+providers.length+' provider(s)');
			res.json({"status": 200, "message": "ok", "data": providers});
		}
	});
}

module.exports = plugin;
