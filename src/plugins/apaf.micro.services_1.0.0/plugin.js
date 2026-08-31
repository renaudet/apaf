/*
 * plugin.js - APL Micro-Services manager for APAF
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const APL_PLUGIN_ID = 'apaf.apl';
const SECURITY_SERVICE_NAME = 'apaf-security';
const MICRO_SERVICE_DATATYPE = 'microService';

var plugin = new ApafPlugin();

plugin.queryMicroServiceHandler = function(req,res){
	plugin.debug('->queryMicroServiceHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.micro.services.query.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryMicroServiceHandler() - security error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let query = (typeof req.body=='object') ? req.body : {};
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(MICRO_SERVICE_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-queryMicroServiceHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryMicroServiceHandler() - success');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.findMicroServiceHandler = function(req,res){
	plugin.debug('->findMicroServiceHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.micro.services.find.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-findMicroServiceHandler() - security error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(MICRO_SERVICE_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-findMicroServiceHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data){
						plugin.debug('<-findMicroServiceHandler() - success');
						res.json({"status": 200,"message": "ok","data": data});
					}else{
						plugin.debug('<-findMicroServiceHandler() - not found');
						res.json({"status": 404,"message": "not found","data": null});
					}
				}
			});
		}
	});
}

plugin.createMicroServiceHandler = function(req,res){
	plugin.debug('->createMicroServiceHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.micro.services.create.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createMicroServiceHandler() - security error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.createdBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(MICRO_SERVICE_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-createMicroServiceHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createMicroServiceHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
				}
			});
		}
	});
}

plugin.updateMicroServiceHandler = function(req,res){
	plugin.debug('->updateMicroServiceHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.micro.services.update.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateMicroServiceHandler() - security error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.lastUpdatedBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.updateRecord(MICRO_SERVICE_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-updateMicroServiceHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-updateMicroServiceHandler() - success');
					res.json({"status": 200,"message": "updated","data": data});
				}
			});
		}
	});
}

plugin.deleteMicroServiceHandler = function(req,res){
	plugin.debug('->deleteMicroServiceHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.micro.services.delete.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteMicroServiceHandler() - security error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(MICRO_SERVICE_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-deleteMicroServiceHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteMicroServiceHandler() - success');
					res.json({"status": 200,"message": "deleted","data": data});
				}
			});
		}
	});
}

plugin._invokeMicroService = function(req, res, httpMethod) {
	plugin.debug('->_invokeMicroService() method=' + httpMethod);
	res.set('Content-Type', 'application/json');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req, '', function(err, user) {
		if(err) {
			plugin.debug('<-_invokeMicroService() - security error');
			res.json({"status": 500, "message": err, "data": null});
		} else {
			let serviceName = req.params.name;
			let serviceVersion = req.params.version;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(MICRO_SERVICE_DATATYPE, {"selector": {"name": {"$eq": serviceName}, "version": {"$eq": serviceVersion}}}, function(err, data) {
				if(err) {
					plugin.debug('<-_invokeMicroService() - query error');
					res.json({"status": 500, "message": err, "data": null});
				} else {
					if(!data || data.length === 0) {
						plugin.debug('<-_invokeMicroService() - not found: ' + serviceName + '/' + serviceVersion);
						res.json({"status": 404, "message": "Micro-service not found: " + serviceName + " v" + serviceVersion, "data": null});
					} else {
						let microService = data[0];
						if(microService.method !== httpMethod) {
							plugin.debug('<-_invokeMicroService() - method mismatch (expected ' + microService.method + ', got ' + httpMethod + ')');
							res.status(400).json({"status": 400, "message": "Bad Request - this micro-service expects method " + microService.method, "data": null});
						} else if(microService.restrictedToRole && microService.restrictedToRole.length > 0 && !user.isAdmin && !(user.roles && typeof user.roles[microService.restrictedToRole] != 'undefined')) {
							plugin.debug('<-_invokeMicroService() - unauthorized (role required: ' + microService.restrictedToRole + ')');
							res.status(403).json({"status": 403, "message": "Forbidden", "data": null});
						} else if(!microService.enabled) {
							plugin.debug('<-_invokeMicroService() - micro-service is disabled');
							res.status(503).json({"status": 503, "message": "Service Unavailable - micro-service is disabled", "data": null});
						} else {
							plugin.debug('_invokeMicroService() - compiling and executing ' + serviceName + '/' + serviceVersion);
							let aplPlugin = plugin.runtime.getPlugin(APL_PLUGIN_ID);
							// Build the request object passed to the script
							let requestObj = {
								method: httpMethod,
								params: req.params,
								query: req.query,
								body: (typeof req.body === 'object') ? req.body : {},
								headers: req.headers
							};
							// Initial context: script receives 'request' and writes into 'response'
							let context = {
								request: requestObj,
								response: {}
							};
							// Wrap source so that the script's process() function is called
							let wrappedSource = microService.source + '\nprocess(request, response);';
							// Built-ins available to the script
							let builtins = {
								print: function(args){ plugin.info('[micro-service:' + serviceName + '] ' + args[0]); }
							};
							aplPlugin.execute(wrappedSource, builtins, function(err, result) {
								if(err) {
									plugin.debug('<-_invokeMicroService() - execution error: ' + err);
									res.json({"status": 500, "message": "Execution error: " + err, "data": null});
								} else {
									plugin.debug('<-_invokeMicroService() - execution success');
									let responseValue = result.memorySpace['.response'];
									res.json({"status": 200, "message": "ok", "data": responseValue});
								}
							}, context);
						}
					}
				}
			});
		}
	});
}

plugin.checkMicroServiceHandler = function(req, res) {
	plugin.debug('->checkMicroServiceHandler()');
	res.set('Content-Type', 'application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.micro.services.check.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req, requiredRole, function(err, user) {
		if(err) {
			plugin.debug('<-checkMicroServiceHandler() - security error');
			res.json({"status": 500, "message": err, "data": null});
		} else {
			let source = req.body && req.body.source ? req.body.source : '';
			let aplPlugin = plugin.runtime.getPlugin(APL_PLUGIN_ID);
			aplPlugin.compile(source, function(err, result) {
				if(err) {
					plugin.debug('<-checkMicroServiceHandler() - internal error');
					res.json({"status": 500, "message": err, "data": null});
				} else if(!result.success) {
					plugin.debug('<-checkMicroServiceHandler() - compilation failure');
					res.json({"status": 200, "message": "ok", "data": {"success": false, "error": result.error}});
				} else {
					plugin.debug('<-checkMicroServiceHandler() - compilation success');
					res.json({"status": 200, "message": "ok", "data": {"success": true, "error": null}});
				}
			});
		}
	});
}

plugin.invokeMicroServiceGetHandler = function(req, res) {
	plugin.debug('->invokeMicroServiceGetHandler()');
	plugin._invokeMicroService(req, res, 'GET');
}

plugin.invokeMicroServicePostHandler = function(req, res) {
	plugin.debug('->invokeMicroServicePostHandler()');
	plugin._invokeMicroService(req, res, 'POST');
}

plugin.invokeMicroServicePutHandler = function(req, res) {
	plugin.debug('->invokeMicroServicePutHandler()');
	plugin._invokeMicroService(req, res, 'PUT');
}

plugin.invokeMicroServiceDeleteHandler = function(req, res) {
	plugin.debug('->invokeMicroServiceDeleteHandler()');
	plugin._invokeMicroService(req, res, 'DELETE');
}

module.exports = plugin;
