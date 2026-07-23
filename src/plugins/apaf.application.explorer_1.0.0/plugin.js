/*
 * plugin.js - APAF Application Explorer plugin for NPA
 * Copyright 2026 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_SERVICE_NAME = 'apaf-security';
const APPLICATION_DATATYPE = 'application';

var plugin = new ApafPlugin();

plugin.queryApplicationsHandler = function(req, res) {
	plugin.debug('->queryApplicationsHandler()');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req, null, function(err, user) {
		if(err) {
			plugin.debug('<-queryApplicationsHandler() - error');
			res.json({"status": 500, "message": err, "data": []});
		} else {
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(APPLICATION_DATATYPE, {"selector": {"published": {"$eq": true}}}, function(err, apps) {
				if(err) {
					plugin.debug('<-queryApplicationsHandler() - error');
					res.json({"status": 500, "message": err, "data": []});
				} else {
					let result = [];
					for(var i = 0; i < apps.length; i++) {
						let application = apps[i];
						if(user.isAdmin ||
						   typeof application.restrictedToRole == 'undefined' ||
						   application.restrictedToRole.length == 0 ||
						   typeof user.roles[application.restrictedToRole] != 'undefined') {
							result.push({
								"id": application.id,
								"name": application.name,
								"version": application.version,
								"description": application.description || '',
								"menuIcon": application.menuIcon || '/uiTools/img/silk/application.png',
								"uri": '/resources/html/apafApplication.html?id=' + application.id
							});
						}
					}
					plugin.debug('<-queryApplicationsHandler() - found ' + result.length + ' application(s)');
					res.json({"status": 200, "message": "ok", "data": result});
				}
			});
		}
	});
};

module.exports = plugin;
