/*
 * plugin.js - APAF application plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const RUNTIME_PROPERTIES_SERVICE_NAME = 'properties';

var plugin = new ApafPlugin();

plugin.start = function(){
	this.name = this.getConfigValue('application.name');
	this.info('Application '+this.name+' starting...');
	let propService = this.getService(RUNTIME_PROPERTIES_SERVICE_NAME);
	propService.setProperty('npa.application.name','apaf');
	propService.lockProperty('npa.application.name');
	// make sure the datatype plugin is loaded
	this.runtime.getPlugin('apaf.datatype');
	// make sure the scheduler plugin is loaded
	this.runtime.getPlugin('apaf.scheduler');
	// starts the HTTP Listener
	var httpServer = plugin.getService('http');
	let applicationPort = this.getConfigValue('application.port');
	if(typeof applicationPort=='string' && applicationPort.length>0){
		httpServer.startListener(applicationPort);
	}else{
		httpServer.startListener();
	}
}

module.exports = plugin;