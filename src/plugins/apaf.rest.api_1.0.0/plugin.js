/*
 * plugin.js - REST API support plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const REST_CALL_SUPPORT_PLUGIN_ID = 'npa.rest';

var plugin = new ApafPlugin();

/*
 * restContext:
  {
	"host": string,
	"port": (optional)integer,
	"uri": string,
	"secured": boolean,
	"username": (optional)string,
	"password": (optional)string,
	"method": GET/PUT/POST/DELETE,
	"payload": (optional)json
  }
 */

plugin.invokeRestApiHandler = function(req,res){
	plugin.debug('->invokeRestApiHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.rest.api.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-invokeRestApiHandler() - error check access');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let restPlugin = plugin.runtime.getPlugin(REST_CALL_SUPPORT_PLUGIN_ID);
			let restContext = req.body;
			restPlugin.performRestApiCall(restContext,function(err,response){
				if(err){
					plugin.debug('<-invokeRestApiHandler() - error REST call');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-invokeRestApiHandler() - success');
					res.json({"status": 200,"message": "success","data": response.data,"headers": response.headers});
				}
			});
		}
	});
}

module.exports = plugin;