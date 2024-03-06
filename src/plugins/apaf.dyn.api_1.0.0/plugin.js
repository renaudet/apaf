/*
 * plugin.js - Dynamic API (servlet) support plugin for APAF
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_SERVICE_NAME = 'apaf-security';
const FRAGMENT_DATATYPE = 'fragment';
const REQUIRED_ROLE = 'coreServices';

var plugin = new ApafPlugin();
var xeval = eval;

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
			let alias = req.params.alias;
			let payload = req.body;
			plugin.lookupServletByAlias(alias,function(err,servlet){
				if(err){
					plugin.debug('<-invokeDynamicApiHandler() - error check servlet');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.invokeServlet(servlet,payload,user,function(err,result){
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

plugin.invokeServlet = function(fragment,payload,user,then){
	this.debug('->invokeServlet()');
	try{
		this.debug('evaluating servlet "'+fragment.alias+'" (v'+fragment.version+') for user "'+user.login+'"');
		let moduleSrc = 'var servlet = {}; var initializeServlet = function(){'+fragment.source+'}';
		xeval(moduleSrc);
		initializeServlet();
		if(typeof servlet.endpoint!='undefined'){
			let context = {"user": user,"runtime": plugin.runtime,"require": require};
			let result = servlet.endpoint(payload,context);
			this.debug('<-invokeServlet() - success');
			then(null,result);
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

module.exports = plugin;