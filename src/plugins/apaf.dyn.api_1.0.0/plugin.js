/*
 * plugin.js - Dynamic API (servlet) support plugin for APAF
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const moment = require('moment');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_SERVICE_NAME = 'apaf-security';
const FRAGMENT_DATATYPE = 'fragment';
const REQUIRED_ROLE = 'coreServices';
const TELEMETRY_SERVICE_NAME = 'telemetry';
const SERVLET_INVOCATION_DIMENSION = 'servlet.invocation';
const TELEMETRY_COLLECT_TIMEOUT = 30;

var plugin = new ApafPlugin();
plugin.totalInvocationCount = 0;
var xeval = eval;

plugin.onConfigurationLoaded = function(){
	setTimeout(function(){ plugin.collectTelemetry(); },TELEMETRY_COLLECT_TIMEOUT*1000);
}

plugin.lookupServletByAlias = function(alias,then){
	this.debug('->lookupServletByAlias()');
	this.debug('alias: '+alias);
	let datatypePlugin = this.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	datatypePlugin.query(FRAGMENT_DATATYPE,{"selector": {"$and": [{"type": {"$eq": "servlet"}},{"alias": {"$eq": alias}}]}},function(err,data){
		if(err){
			plugin.debug('<-lookupServletByAlias() - error looking for fragment');
			then(err,null);
		}else{
			if(data && data.length>0){
				let servlet = data[0];
				if(servlet.enabled){
					plugin.debug('servlet: '+servlet.name+' v'+servlet.version);
					plugin.debug('<-lookupServletByAlias() - success');
					then(null,servlet);
				}else{
					plugin.debug('<-lookupServletByAlias() - error not activated');
					then('Not activated',null);
				}
			}else{
				plugin.debug('<-lookupServletByAlias() - error not found');
				then('No servlet configured with alias "'+alias+'"',null);
			}
		}
	});
}

plugin.invokeDynamicApiHandler = function(req,res){
	plugin.debug('->invokeDynamicApiHandler()');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,REQUIRED_ROLE,function(err,user){
		if(err){
			plugin.debug('<-invokeDynamicApiHandler() - error check access');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let alias = req.params.alias[0];
			plugin.lookupServletByAlias(alias,function(err,servlet){
				if(err){
					plugin.debug('<-invokeDynamicApiHandler() - error check servlet');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.invokeServlet(servlet,req,user,function(err,result){
						if(err){
							plugin.debug('<-invokeDynamicApiHandler() - error servlet invocation');
							res.json({"status": 500,"message": err,"data": []});
						}else{
							plugin.debug('<-invokeDynamicApiHandler() - success');
							res.json({"status": 200,"message": "ok","data": result});
						}
					});
				}
			});
		}
	});
}

plugin.invokeServlet = function(fragment,request,user,then){	
	this.debug('->invokeServlet()');
	try{
		this.debug('evaluating servlet "'+fragment.alias+'" (v'+fragment.version+') for user "'+user.login+'"');
		let moduleSrc = 'var servlet = {}; var initializeServlet = function(){'+fragment.source+'}';
		xeval(moduleSrc);
		initializeServlet();
		if(typeof servlet.endpoint!='undefined'){
			let payload = request.body;
			if(typeof payload=='undefined' || payload==null || Object.keys(payload).length==0){
				payload = request.query;
			}
			let context = {"user": user,"runtime": plugin.runtime,"require": require,"httpRequest": request};
			this.totalInvocationCount++;
			servlet.endpoint(payload,context,then);
			this.debug('<-invokeServlet() - success');
		}else{
			this.debug('<-invokeServlet() - error endpoint not found');
			then('Error executing servlet "'+fragment.alias+'" - no endpoint configured',null);
		}
	}catch(evaluationException){
		console.log(evaluationException);
		this.debug('<-invokeServlet() - error evaluation');
		then('Error executing servlet "'+fragment.alias+'" - exception evaluating the code',null);
	}
}

plugin.collectTelemetry = function(){
	this.trace('->collectTelemetry()');
	let telemetryService = this.getService(TELEMETRY_SERVICE_NAME);
	let telemetryData = {"timestamp": moment().format('YYYY/MM/DD HH:mm:ss'),"count": this.totalInvocationCount};
	telemetryService.push(SERVLET_INVOCATION_DIMENSION,telemetryData);
	this.trace('<-collectTelemetry()');
	setTimeout(function(){ plugin.collectTelemetry(); },TELEMETRY_COLLECT_TIMEOUT*1000);
}

module.exports = plugin;