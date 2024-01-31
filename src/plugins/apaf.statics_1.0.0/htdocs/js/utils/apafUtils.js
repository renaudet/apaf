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