/*
 * sessionMonitor.js - NPA UI Tools Core component framework's SessionMonitor component'
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
const DEFAULT_MONITORING_INTERVAL = 3*60*1000;

apaf.SessionMonitor = class SessionMonitor extends NpaUiComponent{
	initialize(then){
		then();
	}
	render(then){
		let config = this.getConfiguration();
		if(this.parentDiv().data('loaded')!='true'){
			this.startMonitoringLoop(typeof config.monitoringInterval!='undefined'?config.monitoringInterval*1000:DEFAULT_MONITORING_INTERVAL);
		}
		then();
	}
	startMonitoringLoop(interval){
		let monitor = this;
		setTimeout(function(){ monitor.checkSession(interval);},interval);
	}
	checkSession(interval){
		let monitor = this;
		makeRESTCall('PUT','/apaf-admin/session',{},function(response){
			if(200==response.status){
				setTimeout(function(){ monitor.checkSession(interval);},interval);
			}else{
				console.log('SessionMonitor#checkSession() -> '+response.status);
				setTimeout(function(){ window.location.replace('/resources/html/login.html')},500);
			}
		},function(errorMsg){
			console.log('SessionMonitor#checkSession() -> error: '+errorMsg);
			setTimeout(function(){ window.location.replace('/resources/html/login.html')},500);
		});
	}
}