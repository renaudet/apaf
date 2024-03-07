/*
 * plugin.js - APAF security tokens managing plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const moment = require('moment');
const SECURITY_SERVICE_NAME = 'apaf-security';
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_TOKEN_URI_PARAM_NAME = 'token';
const CRYPTOGRAPHY_SERVICE_NAME = 'cryptography';
const TOKEN_DATATYPE_NAME = 'token';

var plugin = new ApafPlugin();

plugin.queryTokensHandler = function(req,res){
	plugin.debug('->queryTokensHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.tokens.query.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryTokensHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			var query = {};
			if(typeof req.body=='object'){
				query = req.body;
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(TOKEN_DATATYPE_NAME,query,function(err,data){
				if(err){
					plugin.debug('<-queryTokensHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryTokensHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.createTokenHandler = function(req,res){
	plugin.debug('->createTokenHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.tokens.create.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createTokenHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			let cryptoService = plugin.getService(CRYPTOGRAPHY_SERVICE_NAME);
			let toEncrypt = record.login+':'+record.password+':'+record.uri;
			record.token = cryptoService.encrypt(toEncrypt);
			record.created = moment().format('YYYY/MM/DD HH:mm:ss');
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(TOKEN_DATATYPE_NAME,record,function(err,data){
				if(err){
					plugin.debug('<-createTokenHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createTokenHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
				}
			});
		}
	});
}

plugin.deleteTokenHandler = function(req,res){
	plugin.debug('->deleteTokenHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.tokens.delete.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteTokenHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(TOKEN_DATATYPE_NAME,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-deleteTokenHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteTokenHandler() - success');
					res.json({"status": 200,"message": "deleted","data": data});
				}
			});
		}
	});
}

module.exports = plugin;