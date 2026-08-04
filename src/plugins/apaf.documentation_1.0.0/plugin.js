/*
 * plugin.js - APAF Documentation plugin for NPA
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const DOCUMENTATION_SERVICE_NAME = 'npa-documentation';

var plugin = new ApafPlugin();

plugin.getTocHandler = function(req, res) {
	plugin.debug('->getTocHandler()');
	res.set('Content-Type', 'application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.documentation.toc.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req, requiredRole, function(err, user) {
		if(err) {
			plugin.debug('<-getTocHandler(500)');
			res.json({"status": 500, "message": err, "data": []});
		} else {
			let docService = plugin.getService(DOCUMENTATION_SERVICE_NAME);
			plugin.debug('<-getTocHandler(200)');
			res.json({"status": 200, "message": "ok", "data": docService.buildToc()});
		}
	});
}

module.exports = plugin;
