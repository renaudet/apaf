/*
 * plugin.js - APAF Registry support plugin
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const MENU_PLUGIN_ID = 'apaf.menu';
const SECURITY_SERVICE_NAME = 'apaf-security';
const RUNTIME_PROPERTIES_SERVICE_NAME = 'properties';
const FEATURE_DATATYPE = 'feature';
const ADMIN_MENU_PLACEHOLDER = 'adminMenuPlaceholder';
const TEAPOT_RESPONSE = {"status": 418,"message": "I\'m a teapot ","data": []};

var plugin = new ApafPlugin();
plugin.registryMode = false;

plugin.start = function(){
	this.name = 'APAF Registry v'+this.config.version;
	this.info('APAF Registry starting...');
	this.registryMode = true;
	let propService = this.getService(RUNTIME_PROPERTIES_SERVICE_NAME);
	propService.setProperty('npa.application.name','registry');
	propService.lockProperty('npa.application.name');
	// make sure the datatype plugin is loaded
	this.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	// the Manage Features menu item is only injected when running as the Registry application
	this.plugFeaturesMenuItem();
	// starts the HTTP Listener
	var httpServer = this.getService('http');
	httpServer.startListener(this.getConfigValue('registry.port','integer'));
}

plugin.plugFeaturesMenuItem = function(){
	let menuPlugin = this.runtime.getPlugin(MENU_PLUGIN_ID);
	menuPlugin.lazzyPlug(this.config.id,{
		"point": "apaf.menu.item.provider",
		"id": "apaf.registry.menu.item",
		"menu": ADMIN_MENU_PLACEHOLDER,
		"securityRole": "administrator",
		"item": {
			"id": "manageRegistryFeatures",
			"label": "@apaf.registry.page.title",
			"actionId": "redirect",
			"icon": "/uiTools/img/silk/brick.png",
			"uri": "/apaf-registry-ui/html/manageFeatures.html"
		}
	});
}

plugin.escapeRegex = function(text){
	return text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}

/*
 * Common frame for the secured Registry GUI handlers:
 * - unavailable (418) unless running as the Registry application
 * - security check with the role declared for the given extension
 */
plugin.secured = function(extensionId,req,res,then){
	res.set('Content-Type','application/json');
	if(!plugin.registryMode){
		plugin.debug('<-'+extensionId+' - unavailable');
		res.json(TEAPOT_RESPONSE);
		return;
	}
	let requiredRole = plugin.getRequiredSecurityRole(extensionId);
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-'+extensionId+' - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			then(user);
		}
	});
}

plugin.queryFeaturesHandler = function(req,res){
	plugin.debug('->queryFeaturesHandler()');
	plugin.secured('apaf.registry.features.query.handler',req,res,function(user){
		let query = {};
		if(typeof req.body=='object' && req.body!=null){
			query = req.body;
		}
		let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		datatypePlugin.query(FEATURE_DATATYPE,query,function(err,data){
			if(err){
				plugin.debug('<-queryFeaturesHandler() - error');
				res.json({"status": 500,"message": err,"data": []});
			}else{
				plugin.debug('<-queryFeaturesHandler() - success');
				res.json({"status": 200,"message": "ok","data": data});
			}
		});
	});
}

plugin.findFeatureHandler = function(req,res){
	plugin.debug('->findFeatureHandler()');
	plugin.secured('apaf.registry.features.find.handler',req,res,function(user){
		let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		datatypePlugin.findByPrimaryKey(FEATURE_DATATYPE,{"id": req.params.id},function(err,data){
			if(err){
				plugin.debug('<-findFeatureHandler() - error');
				res.json({"status": 500,"message": err,"data": []});
			}else{
				if(data){
					plugin.debug('<-findFeatureHandler() - success');
					res.json({"status": 200,"message": "ok","data": data});
				}else{
					plugin.debug('<-findFeatureHandler() - not found');
					res.json({"status": 404,"message": "not found","data": []});
				}
			}
		});
	});
}

plugin.updateFeatureHandler = function(req,res){
	plugin.debug('->updateFeatureHandler()');
	plugin.secured('apaf.registry.features.update.handler',req,res,function(user){
		let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		datatypePlugin.updateRecord(FEATURE_DATATYPE,req.body,function(err,data){
			if(err){
				plugin.debug('<-updateFeatureHandler() - error');
				res.json({"status": 500,"message": err,"data": []});
			}else{
				plugin.debug('<-updateFeatureHandler() - success');
				res.json({"status": 200,"message": "updated","data": data});
			}
		});
	});
}

plugin.deleteFeatureHandler = function(req,res){
	plugin.debug('->deleteFeatureHandler()');
	plugin.secured('apaf.registry.features.delete.handler',req,res,function(user){
		let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		datatypePlugin.deleteRecord(FEATURE_DATATYPE,{"id": req.params.id},function(err,data){
			if(err){
				plugin.debug('<-deleteFeatureHandler() - error');
				res.json({"status": 500,"message": err,"data": []});
			}else{
				plugin.debug('<-deleteFeatureHandler() - success');
				res.json({"status": 200,"message": "deleted","data": data});
			}
		});
	});
}

plugin.storeFeatureHandler = function(req,res){
	plugin.debug('->storeFeatureHandler()');
	if(plugin.registryMode){
		let feature = req.body;
		plugin.trace(JSON.stringify(feature,null,'\t'));
		let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		datatypePlugin.createRecord(FEATURE_DATATYPE,feature,function(err,data){
			if(err){
				plugin.debug('<-storeFeatureHandler() - error');
				res.json({"status": 500,"message": err,"data": []});
			}else{
				plugin.debug('<-storeFeatureHandler() - success');
				res.json({"status": 200,"message": "created","data": data});
			}
		});
	}else{
		plugin.debug('<-storeFeatureHandler() - unavailable');
		res.json(TEAPOT_RESPONSE);
	}
}

plugin.searchFeatureHandler = function(req,res){
	plugin.debug('->searchFeatureHandler()');
	if(plugin.registryMode){
		let category = req.query.category;
		let name = req.query.name;
		let summary = req.query.summary;
		let query = {"selector": {"$and": []}};
		if(typeof category=='string' && category.length>0){
			query.selector['$and'].push({"category": {"$eq": category}});
		}
		if(typeof name=='string' && name.length>0){
			query.selector['$and'].push({"name": {"$regex": plugin.escapeRegex(name)}});
		}
		if(typeof summary!='undefined' && 'true'==summary){
			query.fields = ['id','name','version','category','copyright','description','icon'];
		}
		if(query.selector['$and'].length==0){
			query.selector['$and'].push({"name": {"$regex": "."}});
		}
		let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		datatypePlugin.query(FEATURE_DATATYPE,query,function(err,data){
			if(err){
				plugin.debug('<-searchFeatureHandler() - error');
				res.json({"status": 500,"message": err,"data": []});
			}else{
				plugin.debug('<-searchFeatureHandler() - success');
				res.json({"status": 200,"message": "ok","data": data});
			}
		});
	}else{
		plugin.debug('<-searchFeatureHandler() - unavailable');
		res.json(TEAPOT_RESPONSE);
	}
}

plugin.getFeatureByIdHandler = function(req,res){
	plugin.debug('->getFeatureByIdHandler()');
	if(plugin.registryMode){
		let featureId = req.params.id;
		let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		datatypePlugin.findByPrimaryKey(FEATURE_DATATYPE,{"id": featureId},function(err,data){
			if(err){
				plugin.debug('<-getFeatureByIdHandler() - error');
				res.json({"status": 500,"message": err,"data": []});
			}else{
				plugin.debug('<-getFeatureByIdHandler() - success');
				res.json({"status": 200,"message": "ok","data": data});
			}
		});
	}else{
		plugin.debug('<-getFeatureByIdHandler() - unavailable');
		res.json(TEAPOT_RESPONSE);
	}
}

module.exports = plugin;
