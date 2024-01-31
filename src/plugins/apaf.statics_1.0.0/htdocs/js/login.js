/*
 * login.js - main javascript resource for the APAF Application Login Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';

$(document).ready(function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.onComponentLoaded = onPageReady;
			npaUi.render();
		});
	});
});

onPageReady = function(){
	$('#loginBtn').on('click',function(){
		let userid = $('#userid').val();
		let passwd = $('#passwd').val();
		if(userid && userid.length>0 &&
		   passwd && passwd.length>=6){
			let payload = {};
			payload.userid = userid;
			payload.passwd = passwd;
			makeRESTCall('POST','/apaf-login/login',payload,function(response){
				if(200==response.status){
					console.log(response);
					window.location.replace('/resources/html/home.html')
				}else{
					console.log(response);
					if(response.data){
						showError(response.message);
						showInfo(response.data);
					}else{
						showError(response.message);
					}
					if(412==response.status || 404==response.status){
						$('#userid').val('');
						$('#passwd').val('');
						$('#userid').focus();
					}
					if(500==response.status){
						$('#userid').focus();
					}
					if(401==response.status){
						$('#passwd').val('');
						$('#passwd').focus();
					}
				}
			},function(error){
				showError('@apaf.page.login.error.validation',[error.message]);
				$('#userid').focus();
			});
		}else{
			if(passwd==null || passwd.length<6){
				showWarning('Invalid password!');
				$('#passwd').focus();
			}
			if(username==null || username.length==0){
				showWarning('Username is mandatory!!');
				$('#userid').focus();
			}
		}
	});
}