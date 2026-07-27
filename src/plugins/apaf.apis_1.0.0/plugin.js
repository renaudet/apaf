/*
 * plugin.js - APAF APIs managing plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const HTTP_SERVICE_NAME = 'http';
const JOB_SERVICE_NAME = 'jobs';

var plugin = new ApafPlugin();

plugin.getApisHandler = function(req,res){
	plugin.debug('->getApisHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.apis.query.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getApisHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let httpService = plugin.getService(HTTP_SERVICE_NAME);
			let providers = httpService.providers;
			let pluginName = req.query.plugin;
			let descriptionRegex = req.query.descriptionRegex;
			let descriptionPattern = null;
			if(typeof descriptionRegex!='undefined' && descriptionRegex.length>0){
				try{
					descriptionPattern = new RegExp(descriptionRegex);
				}catch(err){}
			}
			if(Array.isArray(providers.apis) && ((typeof pluginName!='undefined' && pluginName.length>0) || descriptionPattern!=null)){
				providers = Object.assign({},providers);
				providers.apis = providers.apis.filter(function(provider){
					let match = true;
					if(typeof pluginName!='undefined' && pluginName.length>0){
						match = provider.pluginId==pluginName;
					}
					if(match && descriptionPattern!=null){
						let description = (provider.api && provider.api.description)?provider.api.description:'';
						match = descriptionPattern.test(description);
					}
					return match;
				});
			}
			plugin.debug('<-getApisHandler() - success');
			res.json({"status": 200,"message": "ok","data": providers});
		}
	});
}

plugin.getJobsHandler = function(req,res){
	plugin.debug('->getJobsHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.apis.jobs.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getJobsHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let jobService = plugin.getService(JOB_SERVICE_NAME);
			plugin.debug('<-getJobsHandler() - success');
			res.json({"status": 200,"message": "ok","data": jobService.getJobs()});
		}
	});
}

plugin.terminateJobHandler = function(req,res){
	plugin.debug('->terminateJobHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.apis.terminate.job.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-terminateJobHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let jobService = plugin.getService(JOB_SERVICE_NAME);
			let job = jobService.getJob(req.params.id);
			if(typeof job!='undefined'){
				jobService.updateJob({"id": req.params.id,"status": "setRollbackOnly"});
				job = jobService.getJob(req.params.id);
				plugin.debug('<-terminateJobHandler() - success');
				res.json({"status": 200,"message": "ok","data": job});
			}else{
				plugin.debug('<-terminateJobHandler() - not found');
				res.json({"status": 404,"message": "job not found","data": {}});
			}
		}
	});
}

module.exports = plugin;