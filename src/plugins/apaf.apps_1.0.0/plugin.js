/*
 * plugin.js - APAF generic application support plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_SERVICE_NAME = 'apaf-security';
const APPLICATION_DATATYPE = 'application';

var plugin = new ApafPlugin();

plugin.generateAppsMenuHandler = function(req,res){
	plugin.debug('->findApplicationsHandler()');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,null,function(err,user){
		if(err){
			plugin.debug('<-findApplicationsHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(APPLICATION_DATATYPE,{"selector": {"published": {"$eq": true}}},function(err,apps){
				if(err){
					plugin.debug('<-findApplicationsHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					let items = [];
					for(var i=0;i<apps.length;i++){
						let application = apps[i];
						if(user.isAdmin ||
						   typeof application.restrictedToRole=='undefined' ||
						   application.restrictedToRole.length==0 ||
						   typeof user.roles[application.restrictedToRole]!='undefined'){
							let item = {};
							item.id = application.id;
							item.actionId = 'redirect';
							item.label = application.name;
							item.tooltip = application.description;
							item.uri = '/resources/html/apafApplication.html?id='+application.id;
							if(typeof application.menuIcon!='undefined'  && application.menuIcon.length>0){
								item.icon = application.menuIcon;
							}
							items.push(item);
						}
					}
					plugin.debug('<-findApplicationsHandler() - success');
					res.json({"status": 200,"message": "found","data": items});
				}
			});
		}
	});
}

module.exports = plugin;