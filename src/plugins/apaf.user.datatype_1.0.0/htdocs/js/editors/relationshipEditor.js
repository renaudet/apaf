/*
 * relationshipEditor.js - APAF specialized form editor for custom datatype's relationships'
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */
 
if(typeof apafUi=='undefined'){
	apafUi = {};
}

apafUi.relationshipEditorCount = 0;


/*
 * {
		"name": "fieldName,
		"label": "fieldLabel",
		"type": "relationship",
		"siteId": "<some-DIV-#ID>",
		"datatype": "datatype",
		"multiple": true/false,
		"required": true/false,
		"filter": {"selector": {"<field-name>": {"$eq": "value"}}},
		"renderer": "@.firstname+' '+@.lastname",
		"sortOn": "firstname"
   }
 */
apafUi.DatatypeRelationshipEditor = class DatatypeRelationshipEditor extends PluggableEditor {
  uuid = null;
  initialize(){
	///apaf-datatype/datatype?name=bookmark
  }
  getRootUri(){
	return '/user-data/'+this.field.config.datatype;
  }
  loadData(then){
	console.log('DatatypeRelationshipEditor#loadData()');
	let payload = {};
	if(typeof this.field.config.filter!='undefined'){
		payload = this.field.config.filter;
	}
	let editor = this;
	makeRESTCall('POST',this.getRootUri()+'/query',payload,function(response){
		if(response.status==200){
			if(editor.field.config.sortOn){
				then(sortOn(response.data,editor.field.config.sortOn));
			}else{
				then(response.data);
			}	
		}else{
			showError(response.message);
		}
	},function(errorMsg){
		//console.log(errorMsg);
		showError(errorMsg);
	});
  }
  inputFieldId(){
	return this.field.form.getId()+'_'+this.field.config.name;
  }
  render(then){
	console.log('DatatypeRelationshipEditor#render()');
    let editor = this;
	this.uuid = (apafUi.relationshipEditorCount++);
	let html = '';
	if(this.field.config.multiple){
		let visibleRowCount = 5;
		if(typeof this.field.config.rows!='undefined'){
			visibleRowCount = this.field.config.rows;
		}
		html += '<div class="row">'
		html += '  <div class="col-5">';
		html += '    '+this.field.getLocalizedString('@form.multiple.reference.available')+'<br>';
		html += '    <select id="'+this.inputFieldId()+'_source" class="form-select" size="'+visibleRowCount+'" disabled>';
		html += '    </select>';
		html += '  </div>';
		html += '  <div class="col-1">';
		html += '    <br>';
		html += '    <button type="button" id="'+this.inputFieldId()+'_addBtn" class="btn btn-sm form-btn-icon" disabled><img src="/uiTools/img/silk/add.png" title="'+this.field.getLocalizedString('@form.multiple.reference.button.add',[this.field.config.label])+'" class="form-icon"></button><br>';
		html += '    <button type="button" id="'+this.inputFieldId()+'_removeBtn" class="btn btn-sm form-btn-icon" disabled><img src="/uiTools/img/silk/delete.png" title="'+this.field.getLocalizedString('@form.multiple.reference.button.remove',[this.field.config.label])+'" class="form-icon"></button><br>';
		html += '  </div>';
		html += '  <div class="col-5">';
		html += '    '+this.field.getLocalizedString('@form.multiple.reference.associated')+'<br>';
		html += '    <select id="'+this.inputFieldId()+'" class="form-select" size="'+visibleRowCount+'" disabled>';
		html += '    </select>';
		html += '  </div>';
		html += '  <div class="col-1">&nbsp;</div>';
		html += '</div>';
	}else{
		html += '    <select id="'+this.inputFieldId()+'" class="form-select" disabled>';
		if(!this.field.config.required){
			html += '  <option value="">'+this.field.getLocalizedString('@form.SingleReferenceEditorField.select.value')+'</option>';
		}
		html += '    </select>';
		if(this.field.config.help){
			html += '<div class="collapse" id="'+this.inputFieldId()+'_help">';
			html += '  <div class="card card-body form-help">'+this.field.config.help+'</div>';
			html += '</div>';
		}
	}
    //this.getSite().append(html);
    this.getSite().html(html);
    if(this.field.config.multiple){
		this.loadData(function(dataset){
    		editor.resetSourceList();
			let inputFieldId = editor.inputFieldId();
			for(var i=0;i<dataset.length;i++){
				let record = dataset[i];
				editor.createOptionFromRecord(record,inputFieldId+'_source');
			}
			$('#'+inputFieldId+'_source').on('change',function(e){
				$('#'+inputFieldId+'_addBtn').prop('disabled',false);
			});
			$('#'+inputFieldId).on('change',function(e){
				$('#'+inputFieldId+'_removeBtn').prop('disabled',false);
			});
			$('#'+inputFieldId+'_addBtn').on('click',function(){
				var selectedId = $('#'+inputFieldId+'_source option:selected').val();
				var selectedOption =  $('#'+inputFieldId+'_source option[value=\''+selectedId+'\']');
				var itemAlreadyAssociated = false;
				$('#'+inputFieldId+' option').each(function(){
				    var associatedOptionId = $(this).val();
				    if(associatedOptionId==selectedId){
						itemAlreadyAssociated = true;
					}
				});
				if(!itemAlreadyAssociated || (typeof editor.field.config.unique!='undefined' && !editor.field.config.unique)){
					var html = '<option value="'+selectedId+'" title="'+selectedOption.prop('title')+'">'+selectedOption.text()+'</option>';
					$('#'+inputFieldId).append(html);
				}
			});
			$('#'+inputFieldId+'_removeBtn').on('click',function(){
				var selectedId = $('#'+inputFieldId+' option:selected').val();
				var selectedOption =  $('#'+inputFieldId+' option[value=\''+selectedId+'\']');
				selectedOption.remove();
			});
			then();
		});
		if(this.field.pendingValue){
			this.setValue(editor.field.pendingValue);
			delete editor.field.pendingValue;
		}
	}else{
		this.loadData(function(dataset){
    		editor.resetSourceList();
			for(var i=0;i<dataset.length;i++){
				let record = dataset[i];
				editor.createOptionFromRecord(record,editor.inputFieldId());
			}
			if(editor.field.pendingValue){
				editor.setValue(editor.field.pendingValue);
				delete editor.field.pendingValue;
			}
			then();
		});
	}
  }
  resetSourceList(){
	if(this.field.config.multiple){
		let selectId = 	this.inputFieldId()+'_source';
		$('#'+selectId).empty();
	}else{
		let selectId = 	this.inputFieldId();
		$('#'+selectId).empty();
	}
  }
  createOptionFromRecord(record,selectId){
	console.log('DatatypeRelationshipEditor#createOptionFromRecord()');
	if(this.field.config.renderer){
		let value = '';
		let toEval = 'value = '+this.field.config.renderer.replace(/@/g,'record');
		try{
			eval(toEval);
			let option = '<option value="'+record.id+'">'+value+'</option>'
			$('#'+selectId).append(option);
		}catch(e){}
	}
  }
  getValue(){
	if(this.field.config.multiple){
		var refDataIds = [];
		$('#'+this.inputFieldId()+' option').each(function(){
		    var associatedOptionId = $(this).val();
		    refDataIds.push(associatedOptionId);
		});
		return refDataIds;
	}else{
		return $('#'+this.inputFieldId()).val();
	}
  }
  loadDataById(id,then){
	makeRESTCall('GET',this.getRootUri()+'/'+id,{},function(response){
		if(response.status==200){
			then(response.data);
		}else{
			showError(response.message);
		}
	},function(errorMsg){
		//console.log(errorMsg);
		showError(errorMsg);
	});
  }
  setValue(value){
	console.log('relationship editor setValue()');
	if(typeof value!='undefined'){
		if(this.field.config.multiple){
			let inputFieldId = this.inputFieldId();
			$('#'+inputFieldId).empty();
			if(Array.isArray(value)){
				let editor = this;
				var loadReferenceList = function(list,index,dataArray,next){
					if(index<list.length){
						var refDataId = list[index];
						console.log('processing reference: '+refDataId);
						editor.loadDataById(refDataId,function(data){
							console.log('reference found - data id '+JSON.stringify(data));
							if(data && typeof data=='object'){
								dataArray.push(data);
							}
							loadReferenceList(list,index+1,dataArray,next);
						});
					}else{
						next();
					}
				}
				var referencedData = [];
				loadReferenceList(value,0,referencedData,function(){
					for(var i=0;i<referencedData.length;i++){
						let record = referencedData[i];
						editor.createOptionFromRecord(record,inputFieldId);
					}
				});
			}
		}else{
			$('#'+this.inputFieldId()).val(value);
		}
	}else{
		if(this.field.config.multiple){
			let inputFieldId = this.inputFieldId();
			$('#'+inputFieldId).empty();
		}else{
			$('#'+this.inputFieldId()).val('');
		}
	}
  }
  setEnabled(enabledValue){
	if(enabledValue){
		$('#'+this.inputFieldId()).prop('disabled',false);
		$('#'+this.inputFieldId()+'_source').prop('disabled',false);
	}else{
		$('#'+this.inputFieldId()).prop('disabled',true);
		$('#'+this.inputFieldId()+'_source').prop('disabled',true);
	}
  }
}