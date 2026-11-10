/*
 * plugin.js - APAF Rule-data managing plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const moment = require('moment');
const SECURITY_SERVICE_NAME = 'apaf-security';
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const AUDIT_DATATYPE_NAME = 'audit';

var plugin = new ApafPlugin();
plugin.storageFormat = 'YYYY/MM/DD HH:mm:ss';
plugin.displayFormat = 'YYYY/MM/DD HH:mm:ss';

plugin.findAuditRecords = function(dataypeId,entityId,next){
	this.debug('->findAuditRecords()');
	var query = {"selector": {"$and": [{"datatypeid": {"$eq": dataypeId}},{"entityid": {"$eq": entityId}}]}};
	let datatypePlugin = this.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	datatypePlugin.query(AUDIT_DATATYPE_NAME,query,function(err,data){
		if(err){
			plugin.debug('<-findAuditRecords() - error');
			next(err,null);
		}else{
			plugin.debug('<-findAuditRecords() - success');
			next(null,data);
		}
	});
}

plugin.createAuditRecord = function(datatype,entityId,byUser,event,data){
	this.debug('->createAuditRecord()');
	this.trace('datatype: '+(datatype?datatype.name:'n/a'));
	this.trace('entity ID: #'+entityId);
	this.trace('byUser: '+byUser);
	this.trace('event: '+event);
	let record = {};
	record.datatypeid = datatype.id;
	record.entityid = entityId;
	record.timestamp = moment().format(this.storageFormat);
	record.event = event;
	record.byUser = byUser;
	if(typeof data!='undefined'){
		record.data = data;
	}else{
		record.data = null;
	}
	let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	datatypePlugin.createRecord(AUDIT_DATATYPE_NAME,record,function(err,data){
		if(err){
			plugin.error('unable to create Audit record for event '+event+' on entity ID #'+entityId+' of type '+datatype.name+' for user '+byUser);
		}
	});
	this.debug('<-createAuditRecord()');
}

plugin.queryAuditHandler = function(req,res){
	plugin.debug('->queryAuditHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.audit.query.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryAuditHandler() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			//let dataypeId = req.body.dataypeId;
			//let entityId = req.body.entityId;
			//let query = {"selector": {"$and": [{"datatypeid": {"$eq": dataypeId}},{"entityid": {"$eq": entityId}}]}};
			let query = req.body;
			if(typeof query=='undefined'){
				query = {"selector": {}};
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(AUDIT_DATATYPE_NAME,query,function(err,data){
				if(err){
					plugin.debug('<-queryAuditHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryAuditHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.deleteAuditHandler = function(req,res){
	plugin.debug('->deleteAuditHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.audit.delete.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteAuditHandler() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(AUDIT_DATATYPE_NAME,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-deleteAuditHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteAuditHandler()');
					res.json({"status": 200,"message": "deleted","data": data});
				}
			});
		}
	});
}

module.exports = plugin;