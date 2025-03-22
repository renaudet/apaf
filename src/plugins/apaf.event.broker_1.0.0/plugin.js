/*
 * plugin.js - Event broker management plugin for APAF
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const EVENT_BROKER_SERVICE_NAME = 'broker';


var plugin = new ApafPlugin();

plugin.emitEventHandler = function(req,res){
	plugin.debug('->emitEventHandler()');
	//res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.event.broker.emit.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-emitEventHandler(401)');
			res.json({"status": 401,"message": "not authorized","data": {}});
		}else{
			let broker = plugin.getService(EVENT_BROKER_SERVICE_NAME);
			let event = req.body;
			if(broker.emit(event)){
				plugin.debug('<-emitEventHandler(200)');
				res.json({"status": 200,"message": "ok","data": {}});
			}else{
				plugin.debug('<-emitEventHandler(500)');
				res.json({"status": 500,"message": "Internal server error","data": "event discarded due to bad format"});
			}
		}
	});
}

module.exports = plugin;