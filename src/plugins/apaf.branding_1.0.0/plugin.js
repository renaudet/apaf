/*
 * plugin.js - Branding plugin for APAF
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');


var plugin = new ApafPlugin();
plugin.htdocs = '';
plugin.cacheControl = 'private';


plugin.beforeExtensionPlugged = function(){
	this.htdocs = plugin.getLocalDirectory()+'/htdocs';
	if(typeof this.config.cache_control!='undefined'){
		this.cacheControl = this.config.cache_control;
	}
	console.log('Branding resources repository location set to: '+this.htdocs+' (beforeExtensionPlugged)');
}

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
	let wrapper = this.runtime.getPluginWrapper(extenderId);
	this.htdocs = wrapper.getLocalDirectory()+extensionPointConfig.path;
	console.log('Branding resources repository location set to: '+this.htdocs+' (lazzyPlug)');
}

plugin.getBrandingResourceHandler = function(req,res){
	let category = req.params.category;
	let resourceId = req.params.resourceId;
	let path = plugin.htdocs+'/'+category+'/'+resourceId;
	//console.log('path: /'+category+'/'+resourceId);
	res.setHeader('Cache-Control', plugin.cacheControl);
	res.download(path,resourceId);
}

module.exports = plugin;