/*
 * plugin.js - APAF Registry support plugin
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_SERVICE_NAME = 'apaf-security';
const REST_CALL_SUPPORT_PLUGIN_ID = 'npa.rest';
const RUNTIME_PROPERTIES_SERVICE_NAME = 'properties';
const FEATURE_DATATYPE = 'feature';
const ROLE_DATATYPE = 'role';
const FRAGMENT_DATATYPE = 'fragment';
const APPLICATION_DATATYPE = 'application';
const USER_DATATYPE_DATATYPE = 'datatype';
const WORKFLOW_DATATYPE = 'workflow';

var plugin = new ApafPlugin();
plugin.restContext = null;
plugin.registryMode = false;

plugin.start = function(){
	this.name = 'APAF Registry v'+this.config.version;
	this.info('APAF Registry starting...');
	this.registryMode = true;
	let propService = this.getService(RUNTIME_PROPERTIES_SERVICE_NAME);
	propService.setProperty('npa.application.name','registry');
	// make sure the datatype plugin is loaded
	this.runtime.getPlugin('apaf.datatype');
	// starts the HTTP Listener
	var httpServer = this.getService('http');
	httpServer.startListener(this.getConfigValue('registry.port','integer'));
}

plugin.beforeExtensionPlugged = function(){
	this.restContext = {
		"host": this.getConfigValue('registry.host'),
		"port": this.getConfigValue('registry.port','integer'),
		"secured": this.getConfigValue('registry.secured','boolean'),
		"acceptCertificate": true,
		"method": "POST",
		"uri": "/catalog/v1"
	}
}

plugin.publishFeatureHandler = function(req,res){
	plugin.debug('->publishFeatureHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.registry.publish.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-publishFeatureHandler() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let ctx = Object.assign({},plugin.restContext);
			ctx.payload = req.body;
			let restPlugin = plugin.runtime.getPlugin(REST_CALL_SUPPORT_PLUGIN_ID);
			restPlugin.performRestApiCall(ctx,function(err,response){
				if(err){
					plugin.debug('<-publishFeatureHandler() - error REST call');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-publishFeatureHandler() - success');
					res.json({"status": 200,"message": "success","data": response.data});
				}
			});
		}
	});
}

plugin.getCatalogHandler = function(req,res){
	plugin.debug('->getCatalogHandler()');
	res.set('Content-Type','application/json');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,null,function(err,user){
		if(err){
			plugin.debug('<-getCatalogHandler() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let ctx = Object.assign({},plugin.restContext);
			ctx.method = 'GET';
			ctx.payload = {};
			if(req.query.category){
				ctx.uri += '?';
				ctx.uri += 'category='+req.query.category;
			}
			if(req.query.name){
				if(req.query.category){
					ctx.uri += '&';
				}else{
					ctx.uri += '?';
				}
				ctx.uri += 'name='+req.query.name;
			}
			if(req.query.summary && 'true'==req.query.summary){
				if(req.query.category || req.query.name){
					ctx.uri += '&';
				}else{
					ctx.uri += '?';
				}
				ctx.uri += 'summary='+req.query.summary;
			}
			let restPlugin = plugin.runtime.getPlugin(REST_CALL_SUPPORT_PLUGIN_ID);
			restPlugin.performRestApiCall(ctx,function(err,response){
				if(err){
					plugin.debug('<-getCatalogHandler() - error REST call');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-getCatalogHandler() - success');
					res.json({"status": 200,"message": "success","data": response.data});
				}
			});
		}
	});
}

plugin.getFeatureHandler = function(req,res){
	plugin.debug('->getFeatureHandler()');
	res.set('Content-Type','application/json');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,null,function(err,user){
		if(err){
			plugin.debug('<-getFeatureHandler() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let ctx = Object.assign({},plugin.restContext);
			ctx.method = 'GET';
			ctx.uri = '/catalog/feature/'+req.params.id
			ctx.payload = {};
			let restPlugin = plugin.runtime.getPlugin(REST_CALL_SUPPORT_PLUGIN_ID);
			restPlugin.performRestApiCall(ctx,function(err,response){
				if(err){
					plugin.debug('<-getFeatureHandler() - error REST call');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-getFeatureHandler() - success');
					res.json({"status": 200,"message": "success","data": response.data});
				}
			});
		}
	});
}

plugin.installFeatureHandler = function(req,res){
	plugin.debug('->installFeatureHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.registry.install.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-installFeatureHandler() - error security');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let feature = req.body;
			plugin.install(feature,function(err,status){
				if(err){
					plugin.debug('<-installFeatureHandler() - success');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-installFeatureHandler() - success');
					res.json({"status": 200,"message": status,"data": []});
				}
			});
		}
	});
}

plugin.installRoles = function(feature,ctx,then){
	this.debug('->installRoles()');
	let installRole = function(roleLst,index,thenDo){
		if(index<roleLst.length){
			let role = roleLst[index];
			plugin.debug('checking role '+role.name);
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			let query = {"selector": {"name": {"$eq": role.name}}};
			datatypePlugin.query(ROLE_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-installRoles() - error querying database');
					then('unable to query the Role database',null);
				}else{
					if(typeof data=='undefined' || data==null || data.length==0){
						delete role.id;
						plugin.debug('creating role "'+role.name+'"');
						datatypePlugin.createRecord(ROLE_DATATYPE,role,function(err,data){
							if(err){
								plugin.debug('<-installRoles() - error creating role "'+role.name+'"');
								then('unable to create role "'+role.name+'"',null);
							}else{
								installRole(roleLst,index+1,thenDo);
							}
						});
					}else{
						plugin.debug('role "'+role.name+'" already defined!');
						installRole(roleLst,index+1,thenDo);
					}
				}
			});
		}else{
			plugin.debug('<-installRoles() - success');
			thenDo(null,'success');
		}
	}
	installRole(feature.roles,0,then);
}

plugin.installDatatypes = function(feature,ctx,then){
	this.debug('->installDatatypes()');
	let installDatatype = function(datatypeLst,index,thenDo){
		if(index<datatypeLst.length){
			let datatype = datatypeLst[index];
			plugin.debug('checking datatype '+datatype.name);
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			let query = {"selector": {"name": {"$eq": datatype.name}}};
			datatypePlugin.query(USER_DATATYPE_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-installDatatypes() - error querying database');
					then('unable to query the Datatype database',null);
				}else{
					if(typeof data=='undefined' || data==null || data.length==0){
						delete datatype.id;
						datatype.createdBy = feature.copyright;
						plugin.debug('creating datatype "'+datatype.name+'"');
						datatypePlugin.createRecord(USER_DATATYPE_DATATYPE,datatype,function(err,data){
							if(err){
								plugin.debug('<-installDatatypes() - error creating datatype "'+datatype.name+'"');
								then('unable to create datatype "'+datatype.name+'"',null);
							}else{
								installDatatype(datatypeLst,index+1,thenDo);
							}
						});
					}else{
						plugin.debug('datatype "'+datatype.name+'" already defined!');
						installDatatype(datatypeLst,index+1,thenDo);
					}
				}
			});
		}else{
			plugin.debug('<-installDatatypes() - success');
			thenDo(null,'success');
		}
	}
	installDatatype(feature.datatypes,0,then);
}

plugin.installWorkflows = function(feature,ctx,then){
	this.debug('->installWorkflows()');
	let installWorkflow = function(workflowLst,index,thenDo){
		if(index<workflowLst.length){
			let workflow = workflowLst[index];
			plugin.debug('checking workflow '+workflow.name+' v'+workflow.version);
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			let query = {"selector": {"$and": [{"name": {"$eq": workflow.name}},{"version": {"$eq": workflow.version}}]}};
			datatypePlugin.query(WORKFLOW_DATATYPE,query,function(err,data){
				if(err){
					console.log(err);
					plugin.debug('<-installWorkflows() - error querying database');
					then('unable to query the Workflow database',null);
				}else{
					if(typeof data=='undefined' || data==null || data.length==0){
						delete workflow.id;
						workflow.createdBy = feature.copyright;
						workflow.lastUpdatedBy = feature.copyright;
						plugin.debug('creating workflow "'+workflow.name+'"');
						datatypePlugin.createRecord(WORKFLOW_DATATYPE,workflow,function(err,data){
							if(err){
								plugin.debug('<-installWorkflows() - error creating workflow "'+workflow.name+'"');
								then('unable to create workflow "'+workflow.name+'"',null);
							}else{
								installWorkflow(workflowLst,index+1,thenDo);
							}
						});
					}else{
						plugin.debug('workflow "'+workflow.name+'" already defined with version v'+workflow.version);
						installWorkflow(workflowLst,index+1,thenDo);
					}
				}
			});
		}else{
			plugin.debug('<-installWorkflows() - success');
			thenDo(null,'success');
		}
	}
	installWorkflow(feature.workflows,0,then);
}

plugin.installFragments = function(feature,ctx,then){
	this.debug('->installFragments()');
	ctx.fragmentCache = {};
	let installFragment = function(fragmentLst,index,thenDo){
		if(index<fragmentLst.length){
			let fragment = fragmentLst[index];
			plugin.debug('checking fragment '+fragment.name+' v'+fragment.version);
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			let query = {"selector": {"$and": [{"name": {"$eq": fragment.name}},{"version": {"$eq": fragment.version}}]}};
			datatypePlugin.query(FRAGMENT_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-installFragments() - error querying database');
					then('unable to query the Fragment database',null);
				}else{
					let fragmentId = fragment.id;
					if(typeof data=='undefined' || data==null || data.length==0){
						delete fragment.id;
						fragment.createdBy = feature.copyright;
						plugin.debug('creating fragment "'+fragment.name+'"');
						datatypePlugin.createRecord(FRAGMENT_DATATYPE,fragment,function(err,data){
							if(err){
								plugin.debug('<-installFragments() - error creating fragment "'+fragment.name+'"');
								then('unable to create fragment "'+fragment.name+'"',null);
							}else{
								ctx.fragmentCache[fragmentId] = data.id;
								installFragment(fragmentLst,index+1,thenDo);
							}
						});
					}else{
						if(data.length>0){
							let existingFragmentId = data[0].id;
							ctx.fragmentCache[fragmentId] = existingFragmentId;
						}
						plugin.debug('fragment "'+fragment.name+'" already defined with version v'+fragment.version);
						installFragment(fragmentLst,index+1,thenDo);
					}
				}
			});
		}else{
			plugin.debug('<-installFragments() - success');
			thenDo(null,'success');
		}
	}
	installFragment(feature.fragments,0,then);
}

plugin.installApplications = function(feature,ctx,then){
	this.debug('->installApplications()');
	let installApplication = function(applicationLst,index,thenDo){
		if(index<applicationLst.length){
			let application = applicationLst[index];
			plugin.debug('checking application '+application.name);
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			let query = {"selector": {"$and": [{"name": {"$eq": application.name}},{"version": {"$eq": application.version}}]}};
			datatypePlugin.query(APPLICATION_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-installApplications() - error querying database');
					then('unable to query the Application database',null);
				}else{
					if(typeof data=='undefined' || data==null || data.length==0){
						delete application.id;
						application.createdBy = feature.copyright;
						application.lastUpdatedBy = feature.copyright;
						if(application.fragments){
							let newFragmentList = [];
							for(var i=0;i<application.fragments.length;i++){
								let initialFragmentId = application.fragments[i];
								let cachedId = ctx.fragmentCache[initialFragmentId];
								if(typeof cachedId!='undefined' && cachedId!=null){
									newFragmentList.push(cachedId);
								}
							}
							application.fragments = newFragmentList;
						}
						plugin.debug('creating application "'+application.name+'"');
						datatypePlugin.createRecord(APPLICATION_DATATYPE,application,function(err,data){
							if(err){
								plugin.debug('<-installApplications() - error creating application "'+application.name+'"');
								then('unable to create application "'+application.name+'"',null);
							}else{
								installApplication(applicationLst,index+1,thenDo);
							}
						});
					}else{
						plugin.debug('application "'+application.name+'" already defined!');
						installApplication(applicationLst,index+1,thenDo);
					}
				}
			});
		}else{
			plugin.debug('<-installApplications() - success');
			thenDo(null,'success');
		}
	}
	installApplication(feature.applications,0,then);
}

plugin.install = function(feature,then){
	this.debug('->install()');
	let installContext = {};
	this.installRoles(feature,installContext,function(err,status){
		if(err){
			then(err,null);
		}else{
			plugin.installDatatypes(feature,installContext,function(err,status){
				if(err){
					then(err,null);
				}else{
					plugin.installWorkflows(feature,installContext,function(err,status){
						if(err){
							then(err,null);
						}else{
							plugin.installFragments(feature,installContext,function(err,status){
								if(err){
									then(err,null);
								}else{
									plugin.installApplications(feature,installContext,function(err,status){
										if(err){
											then(err,null);
										}else{
											then(null,'success');
										}
									});
								}
							});
						}
					});
				}
			});
		}
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
		res.json({"status": 418,"message": "I\'m a teapot ","data": []});
	}
}

plugin.searchFeatureHandler = function(req,res){
	plugin.debug('->searchFeatureHandler()');
	if(plugin.registryMode){
		let category = req.query.category;
		let name = req.query.name;
		let summary = req.query.summary;
		let query = {"selector": {"$and": []}};
		if(typeof category!='undefined' && category.length>0){
			query.selector['$and'].push({"category": {"$eq": category}});
		}
		if(typeof name!='undefined' && name.length>0){
			query.selector['$and'].push({"name": {"$regex": name}});
		}
		if(typeof summary!='undefined' && 'true'==summary){
			query.fields = ['id','name','version','category','copyright','description','icon'];
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
		res.json({"status": 418,"message": "I\'m a teapot ","data": []});
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
		res.json({"status": 418,"message": "I\'m a teapot ","data": []});
	}
}

module.exports = plugin;