/*
 * plugin.js - APAF UI managing plugin for NPA
 * Copyright 2026 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';

var plugin = new ApafPlugin();
plugin.snippetRegistry = [];

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
	if('apaf.ui.code.editor.snippet.provider'==extensionPointConfig.point){
		this.snippetRegistry.push(extensionPointConfig);
	}
}

plugin.getSuitableSnippetsList = function(req,res){
	plugin.debug('->getSuitableSnippetsList()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.ui.components.sourceCodeEditor.snippets.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getSuitableSnippetsList() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			plugin.debug('<-getSuitableSnippetsList()');
			res.json({"status": 200,"message": "ok","data": plugin.snippetRegistry});
		}
	});
}

module.exports = plugin;