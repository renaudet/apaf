/*
 * dataypeSearch.js - NPA UI Tools Core component framework's DatatypeSearch component
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

apaf.DatatypeSearch = class DatatypeSearch extends NpaUiComponent{
	modalDialog = null;
	datatype = null;
	resultSet = [];
	onQueryCallback = null;
	initialize(then){
		console.log('initialize()');
		this.loadDatatype(then);
	}
	render(then){
		console.log('render()');
		if(this.parentDiv().data('loaded')!='true'){
			this.modalDialog = apaf.createModalDialog({"size": "XXL","title": "Datatype instance search"});
			let component = this;
			this.modalDialog.setOnCloseCallback(function(){
				component.onClose();
			});
			this.createDialogBody();
		}
		then();
	}
	loadDatatype(then){
		console.log('loadDatatype()');
		let uri = '/apaf-datatype/datatype?name='+this.getConfiguration().datatype;
		let component = this;
		makeRESTCall('GET',uri,{},function(response){
			if(response.status==200){
				component.datatype = response.data;
				then();
			}else{
				showError(response.message);
			}
		},function(errorMsg){
			showError(errorMsg);
		});
	}
	queryDatabase(query,then){
		console.log('queryDatabase()');
		let uri = '/user-data/'+this.datatype.name+'/query';
		makeRESTCall('POST',uri,query,function(response){
			if(response.status==200){
				then(response.data);
			}else{
				showError(response.message);
			}
		},function(errorMsg){
			showError(errorMsg);
		});
	}
	createDialogBody(){
		console.log('createDialogBody()');
		//let config = this.getConfiguration();
		let html = '';
		html += '<div id="'+this.datatype.name+'_searchForm_parent"></div>';
		this.modalDialog.setBody(html);
		let formId = this.datatype.name+'_searchForm';
		let formTitle = 'Search for instance(s) of type \''+this.datatype.name+'\'';
		let searchFormConfig = {"id": formId,"version": "1.0.0","type": "Form","configuration": {"title": formTitle,"class": "form-frame-noborder","fields": []}};
		for(var i=0;i<this.datatype.fields.length;i++){
			let field = this.datatype.fields[i];
			if(field.isIdField || field.searchField){
				searchFormConfig.configuration.fields.push(field);
			}
		}
		npaUi.renderSingleComponent(formId+'_parent',searchFormConfig,function(){});
	}
	open(callback){
		console.log('open()');
		this.onQueryCallback = callback;
		this.modalDialog.open();
		let formId = this.datatype.name+'_searchForm';
		$apaf(formId).setEditMode(true);
	}
	onClose(){
		console.log('onClose()');
		let formId = this.datatype.name+'_searchForm';
		let searchData = $apaf(formId).getData();
		let query = {"selector": {"$and": []}};
		for(var fieldName in searchData){
			let fieldValue = searchData[fieldName];
			if(typeof fieldValue!='undefined'){
				let clause = {};
				if(typeof fieldValue=='string' && fieldValue.length>0){
					clause[fieldName] = {"$regex": fieldValue};
					query.selector['$and'].push(clause);
				}
				if(typeof fieldValue=='number' || typeof fieldValue=='boolean'){
					clause[fieldName] = {"$eq": fieldValue};
					query.selector['$and'].push(clause);
				}
				
			}
		}
		console.log(JSON.stringify(query,null,'\t'));
		let component = this;
		this.queryDatabase(query,function(data){
			component.resultSet = data;
			if(component.onQueryCallback!=null){
				component.onQueryCallback(component.resultSet);
			}
		});
	}
}