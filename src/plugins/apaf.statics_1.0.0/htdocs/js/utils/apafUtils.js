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
	makeRESTCall('GET','/apaf-admin/session',{},function(response){
		if(200==response.status){
			if(typeof then!='undefined'){
				then();
			}
		}else{
			console.log('checkSessionStatus() -> '+response.status);
			setTimeout(function(){ window.location.replace('/resources/html/login.html')},500);
		}
	},function(errorMsg){
		console.log('checkSessionStatus() -> error: '+errorMsg);
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
		if(typeof response=='object' && response.status){
			if(200==response.status){
				callWrapper.onSuccessCallback(response.data);
			}else{
				callWrapper.onErrorCallback(response.message);
			}
		}else{
			callWrapper.onSuccessCallback(response);
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
apaf.localize = function(txt,data=[]){
	return npaUi.getLocalizedString(txt,data);
}
const WORKFLOW_ENGINE_DEPS = [
	{"type": "js","uri": "/resources/js/utils/apafNodes.js"},
	{"type": "js","uri": "/resources/js/utils/workflowEngine.js"}
]
apaf.executeWorkflow = function(name,version,context,then){
	//are dependencies already loaded ?
	if(typeof this.workflowDepLoaded=='undefined'){
		loadDeps(WORKFLOW_ENGINE_DEPS,function(){
			apaf.workflowDepLoaded = true;
			apaf.workflowEngine = new WorkflowEngine({});
			loadBuiltInNodeHandlers(apaf.workflowEngine);
			let query = {"selector": {"type": {"$eq": "workflowNode"}}};
			let ctx = {"method": "POST","uri": "/apaf-dev/fragment/query","payload": query};
			apaf.call(ctx)
			    .then(function(fragments){
					for(var i=0;i<fragments.length;i++){
						let customNodeFragment = fragments[i];
						try{
							eval('var helper = {"palette":{},"engine":{}};var initializeHelper = function(){'+customNodeFragment.source+'}');
							initializeHelper();
							if(typeof helper.engine.addCustomNode!='undefined'){
								helper.engine.addCustomNode(apaf.workflowEngine);
							}
						}catch(evalException){
							console.log(evalException);
							showError('Exception evaluating custom Workflow node '+customNodeFragment.name);
						}
					}
					apaf.executeWorkflow(name,version,context,then);
			     })
			    .onError(function(errorMsg){
					then(errorMsg,null);
			     });
		});
	}else{
		// load workflow by name and version
		let query = {"selector": {"name": {"$eq": name}}};
		if(version!=null && version.length>0){
			query =  {"selector": {"$and": [{"name": {"$eq": name}}, {"version": {"$eq": version}}]}};
		}
		let ctx = {"method": "POST","uri": "/apaf-workflow/query","payload": query};
		apaf.call(ctx)
			.then(function(resultSet){
				if(resultSet && resultSet.length>0){
					let sortedResultSet = resultSet.length==1?resultSet:sortOn(resultSet,'version',false);
					let workflow = sortedResultSet[0];
					if(workflow.serverSide){
						let callContext = {};
						callContext.method = 'POST';
						callContext.uri = '/apaf-workflow/execute/'+workflow.id;
						callContext.payload = context;
						apaf.call(callContext)
						    .then(function(workflowResponse){
								then(null,workflowResponse);
							})
							.onError(function(errorMsg){
								then(errorMsg,null);
						    });
					}else{
						let workflowListener = new WorkflowEngineEventListener();
						workflowListener.setEventHandler(function(event){
							if('stop'==event.type){
								then(null,context);
							}else{
								console.log(event);
							}
						});
						apaf.workflowEngine.setEventListener(workflowListener);
						apaf.workflowEngine.start(workflow,context);
					}
				}else{
					then('Not found',null);
				}
			})
			.onError(function(errorMsg){
				then(errorMsg,null);
		    });
	}
}
apaf.getPreferences = function(then){
	makeRESTCall('GET','/apaf-admin/profile?preferences=true',{},function(response){
		if(response.status==200){
			then(response.data);
		}else{
			showWarning(response.message);
		}
	},function(error){
		showError(error.message);
	});
}
apaf.savePreferences = function(preferences,then){
	makeRESTCall('GET','/apaf-admin/profile',{},function(response){
		if(response.status==200){
			//then(response.data);
			let profile = response.data;
			let profileData = {"id": profile.id,"preferences": preferences};
			makeRESTCall('PUT','/apaf-admin/profile',profileData,function(response){
				if(response.status==200){
					then(response.data);
				}else{
					showWarning(response.message);
				}
			},function(error){
				showError(error.message);
			});
		}else{
			showWarning(response.message);
		}
	},function(error){
		showError(error.message);
	});
}