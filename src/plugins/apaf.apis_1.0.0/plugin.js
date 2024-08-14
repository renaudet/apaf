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
			plugin.debug('<-getApisHandler() - success');
			res.json({"status": 200,"message": "ok","data": httpService.providers});
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