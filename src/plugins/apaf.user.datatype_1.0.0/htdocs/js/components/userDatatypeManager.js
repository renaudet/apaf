/*
 * userDatatypeManager.js - NPA UI Tools Core component framework's DataManager component'
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
DatatypeManagerWrapper = class {
	wrappedManager = null;
	interactionCallback = null;
	onErrorCallback = null;
	constructor(dataManager){
		this.wrappedManager = dataManager;
	}
	then(callback){
		this.interactionCallback = callback;
		return this;
	}
	onError(callback){
		this.onErrorCallback = callback;
		return this;
	}
}

/*
 * "configuration": {
    	"datatype": "data-type-name",
    	"queryFilter": {"selector": {},"fields": []}
    }
 */
npaUiCore.DatatypeManager = class DatatypeManager extends NpaUiComponent{
	initialize(then){
		then();
	}
	setConfiguration(config){
		this.config.configuration = config;
	}
	render(then){
		then();
	}
	getRootUri(){
		return '/user-data/'+this.getConfiguration().datatype;
	}
	findByPrimaryKey(pk){
		console.log('DatatypeManager#findByPrimaryKey('+pk+')');
		var dataManagerWrapper = new DatatypeManagerWrapper(this);
		makeRESTCall('GET',this.getRootUri()+'/'+pk,payload,function(response){
			if(response.status==200){
					dataManagerWrapper.interactionCallback(response.data);
			}else{
				if(dataManagerWrapper.onErrorCallback!=null){
					dataManagerWrapper.onErrorCallback(response.message);
				}
			}
		},function(errorMsg){
			if(dataManagerWrapper.onErrorCallback!=null){
				dataManagerWrapper.onErrorCallback(errorMsg);
			}else{
				console.log(errorMsg);
			}
		});
		return dataManagerWrapper;
	}
	query(filterExpr){
		console.log('DatatypeManager#query()');
		var dataManagerWrapper = new DatatypeManagerWrapper(this);
		let payload = {};
		if(typeof filterExpr!='undefined'){
			payload = filterExpr;
		}else{
			if(typeof this.getConfiguration().queryFilter!='undefined'){
				payload = this.getConfiguration().queryFilter;
			}
		}
		makeRESTCall('POST',this.getRootUri()+'/query',payload,function(response){
			if(response.status==200){
					dataManagerWrapper.interactionCallback(response.data);
			}else{
				if(dataManagerWrapper.onErrorCallback!=null){
					dataManagerWrapper.onErrorCallback(response.message);
				}
			}
		},function(errorMsg){
			if(dataManagerWrapper.onErrorCallback!=null){
				dataManagerWrapper.onErrorCallback(errorMsg);
			}else{
				console.log(errorMsg);
			}
		});
		return dataManagerWrapper;
	}
	create(record){
		console.log('DatatypeManager#create()');
		var dataManagerWrapper = new DatatypeManagerWrapper(this);
		makeRESTCall('POST',this.getRootUri(),record,function(response){
			if(response.status==200){
					dataManagerWrapper.interactionCallback(response.data);
			}else{
				if(dataManagerWrapper.onErrorCallback!=null){
					dataManagerWrapper.onErrorCallback(response.message);
				}
			}
		},function(errorMsg){
			if(dataManagerWrapper.onErrorCallback!=null){
				dataManagerWrapper.onErrorCallback(errorMsg);
			}else{
				console.log(errorMsg);
			}
		});
		return dataManagerWrapper;
	}
	update(record){
		console.log('DatatypeManager#update()');
		if(typeof record.id=='undefined'){
			return this.create(record);
		}else{
			var dataManagerWrapper = new DatatypeManagerWrapper(this);
			makeRESTCall('PUT',this.getRootUri(),record,function(response){
				if(response.status==200){
						dataManagerWrapper.interactionCallback(response.data);
				}else{
					if(dataManagerWrapper.onErrorCallback!=null){
						dataManagerWrapper.onErrorCallback(response.message);
					}
				}
			},function(errorMsg){
				if(dataManagerWrapper.onErrorCallback!=null){
					dataManagerWrapper.onErrorCallback(errorMsg);
				}else{
					console.log(errorMsg);
				}
			});
			return dataManagerWrapper;
		}
	}
	delete(record){
		console.log('DatatypeManager#delete()');
		var dataManagerWrapper = new DatatypeManagerWrapper(this);
		makeRESTCall('DELETE',this.getRootUri()+'/'+record.id,{},function(response){
			if(response.status==200){
					dataManagerWrapper.interactionCallback(response.data);
			}else{
				if(dataManagerWrapper.onErrorCallback!=null){
					dataManagerWrapper.onErrorCallback(response.message);
				}
			}
		},function(errorMsg){
			if(dataManagerWrapper.onErrorCallback!=null){
				dataManagerWrapper.onErrorCallback(errorMsg);
			}else{
				console.log(errorMsg);
			}
		});
		return dataManagerWrapper;
	}
}