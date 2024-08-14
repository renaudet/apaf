/*
 * plugin.js - Job REST API for APAF applications
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const JOB_SERVICE_NAME = 'jobs';

var plugin = new ApafPlugin();

plugin.createJobHandler = function(req,res){
	plugin.debug('->createJobHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.job.create.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createJobHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let jobService = plugin.getService(JOB_SERVICE_NAME);
			let description = req.body.description;
			let job = jobService.createJob(user.login,description);
			plugin.debug('<-createJobHandler() - success');
			res.json({"status": 200,"message": "ok","data": job});
		}
	});
}

plugin.getJobHandler = function(req,res){
	plugin.debug('->getJobHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.job.get.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getJobHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let jobService = plugin.getService(JOB_SERVICE_NAME);
			let job = jobService.getJob(req.params.id);
			if(typeof job!='undefined'){
				plugin.debug('<-getJobHandler() - success');
				res.json({"status": 200,"message": "ok","data": job});
			}else{
				plugin.debug('<-getJobHandler() - not found');
				res.json({"status": 404,"message": "not found","data": {}});
			}
		}
	});
}

plugin.updateJobHandler = function(req,res){
	plugin.debug('->updateJobHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.job.update.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateJobHandler() - error unauthorized access');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let jobService = plugin.getService(JOB_SERVICE_NAME);
			let updateData = req.body;
			if(updateData && updateData.id){
				let job = jobService.getJob(updateData.id);
				if(typeof job!='undefined'){
					if(user.login==job.owner || user.isAdmin){
						jobService.updateJob(updateData);
						job = jobService.getJob(updateData.id);
						plugin.debug('<-updateJobHandler() - success');
						res.json({"status": 200,"message": "ok","data": job});
					}else{
						plugin.debug('<-updateJobHandler() - not owner');
						res.json({"status": 401,"message": "not owner nor admin","data": {}});
					}
				}else{
					plugin.debug('<-updateJobHandler() - not found');
					res.json({"status": 404,"message": "not found","data": {}});
				}
			}else{
				plugin.debug('<-updateJobHandler() - bad request');
				res.json({"status": 400,"message": "bad request","data": {}});
			}
		}
	});
}

module.exports = plugin;