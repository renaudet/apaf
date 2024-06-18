/*
 * plugin.js - APAF Schedulers managing plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const Engine = require('./engine.js');
const moment = require('moment');
const SECURITY_SERVICE_NAME = 'apaf-security';
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SCHEDULER_DATATYPE_NAME = 'scheduler';
const ENGINE_STARTUP_DELAY = 10000;

var plugin = new ApafPlugin();
plugin.engine = null;

plugin.onConfigurationLoaded = function(){
	this.engine = new Engine(this);
	setTimeout(function(){ plugin.engine.start(); },ENGINE_STARTUP_DELAY);
}

plugin.querySchedulersHandler = function(req,res){
	plugin.debug('->querySchedulersHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.scheduler.query.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-querySchedulersHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			var query = {};
			if(typeof req.body=='object'){
				query = req.body;
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(SCHEDULER_DATATYPE_NAME,query,function(err,data){
				if(err){
					plugin.debug('<-querySchedulersHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-querySchedulersHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.createSchedulerHandler = function(req,res){
	plugin.debug('->createSchedulerHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.scheduler.create.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createSchedulerHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.createdBy = user.login;
			record.created = moment().format('YYYY/MM/DD HH:mm:ss');
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(SCHEDULER_DATATYPE_NAME,record,function(err,data){
				if(err){
					plugin.debug('<-createSchedulerHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createSchedulerHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
				}
			});
		}
	});
}

plugin.updateSchedulerHandler = function(req,res){
	plugin.debug('->updateSchedulerHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.scheduler.update.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateSchedulerHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.updatedBy = user.login;
			record.updated = moment().format('YYYY/MM/DD HH:mm:ss');
			delete record.lastExecuted;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.updateRecord(SCHEDULER_DATATYPE_NAME,record,function(err,data){
				if(err){
					plugin.debug('<-updateSchedulerHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-updateSchedulerHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
				}
			});
		}
	});
}

plugin.deleteSchedulerHandler = function(req,res){
	plugin.debug('->deleteSchedulerHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.scheduler.delete.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteSchedulerHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(SCHEDULER_DATATYPE_NAME,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-deleteSchedulerHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteSchedulerHandler() - success');
					res.json({"status": 200,"message": "deleted","data": data});
				}
			});
		}
	});
}

module.exports = plugin;