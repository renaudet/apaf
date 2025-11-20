/*
 * plugin.js - Telemetry support plugin for APAF
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const TELEMETRY_SERVICE_ID = 'telemetry';

var plugin = new ApafPlugin();

plugin.getDimensionListHandler = function(req,res){
	plugin.debug('->getDimensionListHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.telemetry.list.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getDimensionListHandler() - error check access');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let telemetryService = plugin.getService(TELEMETRY_SERVICE_ID);
			plugin.debug('<-getDimensionListHandler() - success');
			res.json({"status": 200,"message": "success","data": telemetryService.getDimensionList()});
		}
	});
}

plugin.collectDimensionHandler = function(req,res){
	plugin.debug('->collectDimensionHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.telemetry.collect.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-collectDimensionHandler() - error check access');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let telemetryService = plugin.getService(TELEMETRY_SERVICE_ID);
			let dimName = req.params.dimensionName;
			let data = telemetryService.getDataPoints(dimName);
			plugin.debug('<-collectDimensionHandler() - success');
			res.json({"status": 200,"message": "success","data": data});
		}
	});
}

module.exports = plugin;