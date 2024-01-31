/*
 * plugin.js - APAF application plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const ENV_NAME = 'APPLICATION_NAME';
const ENV_APPLICATION_PORT = 'APPLICATION_PORT';

var plugin = new ApafPlugin();

plugin.start = function(){
	this.name = process.env[ENV_NAME];
	this.info('Application '+this.name+' starting...');
	// make sure the datatype plugin is loaded
	this.runtime.getPlugin('apaf.datatype');
	// starts the HTTP Listener
	var httpServer = plugin.getService('http');
	if(typeof process.env[ENV_APPLICATION_PORT]!='undefined'){
		httpServer.startListener(process.env[ENV_APPLICATION_PORT]);
	}else{
		httpServer.startListener();
	}
}

module.exports = plugin;