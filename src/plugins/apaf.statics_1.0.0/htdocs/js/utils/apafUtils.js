/*
 * apafUtils.js - utility resource for APAF
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
$.urlParam = function(name){
    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results==null){
       return null;
    }
    else{
       return results[1] || 0;
    }
}
 
function checkSessionStatus(then){
	console.log('checkSessionStatus()');
	makeRESTCall('GET','/apaf-admin/session',{},function(response){
		console.log(response);
		if(200==response.status){
			if(typeof then!='undefined'){
				then();
			}
		}else{
			//console.log(response);
			//showError('Unable to load page: '+response.message);
			setTimeout(function(){ window.location.replace('/resources/html/login.html')},500);
		}
	},function(errorMsg){
		//showError('Unable to load page: '+errorMsg);
		setTimeout(function(){ window.location.replace('/resources/html/login.html')},500);
	});
}

function increaseVersionNumber(vn){
	if(vn && vn.length>1){
		var numbers = vn.split('.');
		var newVersion = '';
		for(var i=0;i<numbers.length-1;i++){
			number = numbers[i];
			newVersion+=number;
			newVersion+='.';
		}
		try{
			newVersion += (eval(numbers[numbers.length-1])+1);
		}catch(e){
			newVersion += '1';
		}
		return newVersion;
	}else{
		return "1.0.0";
	}
}

ApafCallWrapper = class {
	onSuccessCallback = null;
	onErrorCallback = null;
	constructor(){
	}
	then(callback){
		this.onSuccessCallback = callback;
		return this;
	}
	onError(callback){
		this.onErrorCallback = callback;
		return this;
	}
}

$apaf = function(componentId){
	return npaUi.getComponent(componentId);
}

var apaf = {};
apaf.call = function(callContext){
	let callWrapper = new ApafCallWrapper();
	let method = 'GET';
	let uri = '/';
	let payload = {};
	if(typeof callContext.method!='undefined'){
		method = callContext.method;
	}
	if(typeof callContext.uri!='undefined'){
		uri = callContext.uri;
	}
	if(typeof callContext.payload!='undefined'){
		payload = callContext.payload;
	}
	makeRESTCall(method,uri,payload,function(response){
		console.log('apaf.call():');
		console.log(callContext);
		console.log(response);
		if(200==response.status){
			callWrapper.onSuccessCallback(response.data);
		}else{
			callWrapper.onErrorCallback(response.message);
		}
	},function(errorMsg){
		if(errorMsg.httpStatus==404){
			callWrapper.onErrorCallback('API \''+uri+'\' not found for method \''+method+'\'!');
		}else
			callWrapper.onErrorCallback(errorMsg.message?errorMsg.message:errorMsg);
	});
	return callWrapper;
}
apaf.put = function(putContext){
	if(typeof putContext.contentType=='undefined' || 'application/json'==putContext.contentType){
		putContext.method = 'PUT';
		return this.call(putContext);
	}else{
		let callWrapper = new ApafCallWrapper();
		$.ajax({
	      url        : putContext.uri,
	      type       : 'PUT',
	      contentType: putContext.contentType,
		  success    : function(){},
	      data       : putContext.payload
	    })
		.done(function (response) {
			callWrapper.onSuccessCallback(response);
		})
		.fail(function(jqXHR, textStatus) {
			var errorMsg = jqXHR.responseText;
			if(jqXHR.status!=200){
				errorMsg = jqXHR.statusText;
			}
			callWrapper.onErrorCallback(errorMsg);
		});
		return callWrapper;
	}
}
apaf.upload = function(folderPath,filename,formData){
	let callWrapper = new ApafCallWrapper();
	let encrypted = btoa(folderPath);
	var actionUrl = '/apaf-workspace/file/'+encrypted;
	$.ajax({
      url        : actionUrl,
      type       : 'POST',
      data       : formData,
	  processData: false,
      contentType: false,
      success    : function(){}
	})
	.done(function (response) {
		callWrapper.onSuccessCallback(response);
	})
	.fail(function( jqXHR, textStatus ) {
		var errorMsg = jqXHR.responseText; // assume it is plain text
		if(jqXHR.status!=200){
			errorMsg = jqXHR.statusText;
		}
		callWrapper.onErrorCallback(errorMsg);
	});
	return callWrapper;
}
apaf.localize = function(txt){
	return npaUi.getLocalizedString(txt);
}