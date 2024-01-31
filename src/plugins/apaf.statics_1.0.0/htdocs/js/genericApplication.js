/*
 * genericApplication.js - main javascript resource for the APAF Generic Application Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';

var application = null;
var xeval = eval;

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.onComponentLoaded = loadApplication;
			npaUi.render();
		});
	});
}

loadApplication = function(){
	let appId = $.urlParam('id');
	makeRESTCall('GET','/apaf-dev/application/'+appId,{},function(response){
		if(response.status==200){
			application = response.data;
			$('#applicationName').html(application.name);
			loadApplicationDeps();
		}else{
			console.log(response);
			showError('@apaf.apps.page.error.loading');
		}
	},function(errorMsg){
		console.log(errorMsg);
		showError('@apaf.apps.page.error.loading');
	});
}

loadApplicationDeps = function(){
	let loadFragments = function(list,index,then){
		if(index<list.length){
			let fragmentId = list[index];
			makeRESTCall('GET','/apaf-dev/fragment/'+fragmentId,{},function(response){
				if(response.status==200){
					let fragment = response.data;
					try{
						xeval(fragment.source);
						loadFragments(list,index+1,then);
					}catch(evalException){
						console.log(evalException);
						showError('@apaf.apps.page.error.loading');
					}
				}else{
					console.log(response);
					showError('@apaf.apps.page.error.loading');
				}
			},function(){
				console.log(errorMsg);
				showError('@apaf.apps.page.error.loading');
			});
		}else{
			then();
		}
	}
	loadFragments(application.fragments,0,function(){
		if(typeof main!='undefined'){
			main();
		}else{
			showError('@apaf.apps.page.error.no-main');
		}
	});
}