/*
 * plugin.js - Runtime properties management plugin for APAF
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const PROPERTIES_SERVICE_NAME = 'properties';


var plugin = new ApafPlugin();

plugin.getPropertiesHandler = function(req,res){
	plugin.debug('->getPropertiesHandler()');
	//res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.runtime.properties.getProperties.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getPropertiesHandler(500)');
			res.json({"status": 500,"message": "no session","data": err});
		}else{
			let properties = plugin.getService(PROPERTIES_SERVICE_NAME);
			plugin.debug('<-getPropertiesHandler(200)');
			res.json({"status": 200,"message": "ok","data": properties.getProperties()});
		}
	});
}

plugin.getPropertyHandler = function(req,res){
	plugin.debug('->getPropertyHandler()');
	//res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.runtime.properties.getProperty.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getPropertyHandler(500)');
			res.json({"status": 500,"message": "no session","data": err});
		}else{
			let properties = plugin.getService(PROPERTIES_SERVICE_NAME);
			let value = properties.getProperty(req.params.name);
			if(typeof value!='undefined'){
				plugin.debug('<-getPropertyHandler(200)');
				res.json({"status": 200,"message": "ok","data": value});
			}else{
				plugin.debug('<-getPropertyHandler(404)');
				res.json({"status": 404,"message": "not found","data": {}});
			}
		}
	});
}

plugin.setPropertyHandler = function(req,res){
	plugin.debug('->getPropertyHandler()');
	//res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.runtime.properties.setProperty.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getPropertyHandler(500)');
			res.json({"status": 500,"message": "no session","data": err});
		}else{
			let properties = plugin.getService(PROPERTIES_SERVICE_NAME);
			let propertyToSet = req.body;
			let value = properties.getProperty(propertyToSet.name);
			if(typeof value!='undefined'){
				plugin.debug('<-getPropertyHandler(200)');
				res.json({"status": 200,"message": "ok","data": properties.setProperty(propertyToSet.name,propertyToSet.value)});
			}else{
				plugin.debug('<-getPropertyHandler(404)');
				let prop = properties.newProperty(propertyToSet);
				res.json({"status": 200,"message": "ok","data": prop});
			}
		}
	});
}


module.exports = plugin;