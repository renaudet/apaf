/*
 * plugin.js - APAF mail provider plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
//const moment = require('moment');
const SECURITY_SERVICE_NAME = 'apaf-security';
//const CRYPTOGRAPHY_SERVICE_NAME = 'cryptography';
const DEFAULT_MAIL_PROVIDER_ID = 'SMTP';
const MAIL_SERVICE_NAME = 'mail';

var plugin = new ApafPlugin();

plugin.sendMailHandler = function(req,res){
	plugin.debug('->sendMailHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.mail.provider.sendMail.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-sendMailHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let ctx = req.body;
			if(typeof ctx!='undefined' &&
			   typeof ctx.from!='undefined' &&
			   typeof ctx.to!='undefined' &&
			   typeof ctx.subject!='undefined' &&
			   typeof ctx.content!='undefined'){
				let asHtml = true;
				if(typeof ctx.asText!='undefined' && ctx.asText){
					asHtml = false;
				}
				let mailService = plugin.getService(MAIL_SERVICE_NAME);
				mailService.sendMail(DEFAULT_MAIL_PROVIDER_ID,ctx.from,ctx.to,ctx.subject,ctx.content,asHtml,function(err,response){
					if(err){
						plugin.debug('<-sendMailHandler() - error sending mail');
						res.json({"status": 500,"message": "The mail could not be send","data": err});
					}else{
						plugin.debug('<-sendMailHandler() - success');
						res.json({"status": 200,"message": "sent","data": response});
					}
				});
			}else{
				plugin.debug('<-sendMailHandler() - bad request');
				res.json({"status": 406,"message": "Bad request","data": []});
			}
		}
	});
}

module.exports = plugin;