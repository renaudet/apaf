/*
 * plugin.js - APAF Development Model plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_SERVICE_NAME = 'apaf-security';
const FRAGMENT_DATATYPE = 'fragment';
const APPLICATION_DATATYPE = 'application';

var plugin = new ApafPlugin();
plugin.snippetRegistry = [];
plugin.wizardProviders = [];

/*
 * expected extension point format:
  {
	"id": <extension-id>,
	"point": "apaf.dev.snippet.provider",
	"category": <snippet-category>,
	"label": <snippet description>,
	"location": <snippet-source-uri>,
  }
 */
plugin.lazzyPlug = function(extenderId,extensionPointConfig){
	if('apaf.dev.snippet.provider'==extensionPointConfig.point){
		this.snippetRegistry.push(extensionPointConfig);
	}
	if('apaf.dev.editor.wizard.provider'==extensionPointConfig.point){
		this.wizardProviders.push(extensionPointConfig);
	}
}

plugin.queryFragmentHandler = function(req,res){
	plugin.debug('->queryFragmentHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.dev.query.fragment.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryFragmentHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			var query = {};
			if(typeof req.body=='object'){
				query = req.body;
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(FRAGMENT_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-queryFragmentHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryFragmentHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.createFragmentHandler = function(req,res){
	plugin.debug('->createFragmentHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.dev.create.fragment.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createFragmentHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.createdBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(FRAGMENT_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-createFragmentHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createFragmentHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
				}
			});
		}
	});
}

plugin.updateFragmentHandler = function(req,res){
	plugin.debug('->updateFragmentHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.dev.update.fragment.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateFragmentHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.lastUpdatedBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.updateRecord(FRAGMENT_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-updateFragmentHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-updateFragmentHandler() - success');
					res.json({"status": 200,"message": "updated","data": data});
				}
			});
		}
	});
}

plugin.deleteFragmentHandler = function(req,res){
	plugin.debug('->deleteFragmentHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.dev.delete.fragment.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteFragmentHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(FRAGMENT_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-deleteFragmentHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteFragmentHandler() - success');
					res.json({"status": 200,"message": "deleted","data": data});
				}
			});
		}
	});
}

plugin.findFragmentHandler = function(req,res){
	plugin.debug('->findFragmentHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.dev.find.fragment.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-findFragmentHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(FRAGMENT_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-findFragmentHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-findFragmentHandler() - success');
					res.json({"status": 200,"message": "found","data": data});
				}
			});
		}
	});
}



plugin.queryApplicationHandler = function(req,res){
	plugin.debug('->queryApplicationHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.dev.query.application.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryApplicationHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			var query = {};
			if(typeof req.body=='object'){
				query = req.body;
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(APPLICATION_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-queryApplicationHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryApplicationHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.createApplicationHandler = function(req,res){
	plugin.debug('->createApplicationHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.dev.create.application.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createApplicationHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.createdBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(APPLICATION_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-createApplicationHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createApplicationHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
				}
			});
		}
	});
}

plugin.updateApplicationHandler = function(req,res){
	plugin.debug('->updateApplicationHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.dev.update.application.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateApplicationHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			record.lastUpdatedBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.updateRecord(APPLICATION_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-updateApplicationHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-updateApplicationHandler() - success');
					res.json({"status": 200,"message": "updated","data": data});
				}
			});
		}
	});
}

plugin.deleteApplicationHandler = function(req,res){
	plugin.debug('->deleteApplicationHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.dev.delete.application.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteApplicationHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(APPLICATION_DATATYPE,{"id": recordId},function(err,application){
				if(err){
					plugin.debug('<-deleteApplicationHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(application.published){
						plugin.debug('<-deleteApplicationHandler() - published');
						res.json({"status": 403,"message": "Application is published!","data": []});
					}else{
						datatypePlugin.deleteRecord(APPLICATION_DATATYPE,{"id": recordId},function(err,data){
							if(err){
								plugin.debug('<-deleteApplicationHandler() - error');
								res.json({"status": 500,"message": err,"data": []});
							}else{
								plugin.debug('<-deleteApplicationHandler() - success');
								res.json({"status": 200,"message": "deleted","data": data});
							}
						});
					}
				}
			});
		}
	});
}

plugin.findApplicationHandler = function(req,res){
	plugin.debug('->findApplicationHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.dev.find.application.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-findApplicationHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(APPLICATION_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-findApplicationHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-findApplicationHandler() - success');
					res.json({"status": 200,"message": "found","data": data});
				}
			});
		}
	});
}

plugin.getSnippetsHandler = function(req,res){
	plugin.debug('->getSnippetsHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.dev.snippet.query.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getSnippetsHandler() - error authorization');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			plugin.debug('<-findApplicationHandler() - success');
			res.json({"status": 200,"message": "ok","data": plugin.snippetRegistry});
		}
	});
}

plugin.getWizardsHandler = function(req,res){
	plugin.debug('->getWizardsHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.dev.wizard.query.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getWizardsHandler() - error authorization');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			plugin.debug('<-getWizardsHandler() - success');
			res.json({"status": 200,"message": "ok","data": plugin.wizardProviders});
		}
	});
}

module.exports = plugin;