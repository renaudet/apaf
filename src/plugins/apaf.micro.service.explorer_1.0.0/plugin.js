/*
 * plugin.js - Micro-Service Explorer plugin for APAF
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const REMOTE_CONTEXT_PROVIDER_EXTENSION_POINT = 'apaf.remote.context.provider';

var plugin = new ApafPlugin();
plugin.remoteProviders = [];

/*
 * Collect contributions to the apaf.remote.context.provider extension point.
 * Each contribution must carry: label, queryUri, invokeUri.
 */
plugin.lazzyPlug = function(extenderId, extensionPointConfig){
	if(REMOTE_CONTEXT_PROVIDER_EXTENSION_POINT == extensionPointConfig.point){
		this.info('registering remote context provider "'+extensionPointConfig.label+'" from plugin '+extenderId);
		this.remoteProviders.push({
			id:         extensionPointConfig.id,
			label:      extensionPointConfig.label,
			queryUri:   extensionPointConfig.queryUri,
			invokeUri:  extensionPointConfig.invokeUri
		});
	}
}

plugin.getRemoteProvidersHandler = function(req, res){
	plugin.debug('->getRemoteProvidersHandler()');
	res.set('Content-Type', 'application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.micro.service.explorer.remote.providers.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req, requiredRole, function(err, user){
		if(err){
			plugin.debug('<-getRemoteProvidersHandler() - error access');
			res.json({"status": 500, "message": err, "data": []});
		}else{
			plugin.debug('<-getRemoteProvidersHandler() - '+plugin.remoteProviders.length+' provider(s)');
			res.json({"status": 200, "message": "ok", "data": plugin.remoteProviders});
		}
	});
}

module.exports = plugin;
