/*
 * ruleDataReferenceEditor.js - APAF specialized form editor for custom datatype's relationships'
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */
 
if(typeof apafUi=='undefined'){
	apafUi = {};
}


/*
 * {
		"name": "fieldName,
		"label": "fieldLabel",
		"type": "ruleData",
		"siteId": "<some-optional-DIV-#ID>",
		"ruleData": "ruleDataName",
		"required": true/false,
		"sortStrategy": "asc/desc/none(default)"
   }
 */
apafUi.RuleDataReferenceEditor = class RuleDataReferenceEditor extends PluggableEditor {
  initialize(){
  }
  getRootUri(){
	return '/apaf-rule-data/rule/'+this.field.config.ruleData;
  }
  loadData(then){
	let editor = this;
	makeRESTCall('GET',this.getRootUri(),{},function(response){
		if(response.status==200){
			if(editor.field.config.sortStrategy){
				let sortedValues = response.data.values;
				if('asc'==editor.field.config.sortStrategy){
					sortedValues = sortOn(response.data.values,'');
				}
				if('desc'==editor.field.config.sortStrategy){
					sortedValues = sortOn(response.data.values,'',false);
				}
				then(sortedValues);
			}else{
				then(response.data.values);
			}
		}else{
			showError(response.message);
		}
	},function(errorMsg){
		showError(errorMsg);
	});
  }
  inputFieldId(){
	return this.field.form.getId()+'_'+this.field.config.name;
  }
  resetList(){
		$('#'+this.inputFieldId()).empty();
  }
  render(then){
	console.log('-> apafUi.RuleDataReferenceEditor#render()');
    let editor = this;
	let html = '';
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
    this.getSite().html(html);
	this.loadData(function(dataset){
		editor.resetList();
		for(var i=0;i<dataset.length;i++){
			let value = dataset[i];
			editor.createOptionFromValue(value);
		}
		if(editor.field.pendingValue){
			editor.setValue(editor.field.pendingValue);
			delete editor.field.pendingValue;
		}
		console.log('<- apafUi.RuleDataReferenceEditor#render()');
		then();
	});
  }
  createOptionFromValue(value){
	let option = '<option>'+value+'</option>'
	$('#'+this.inputFieldId()).append(option);
  }
  getValue(){
	return $('#'+this.inputFieldId()).val();
  }
  setValue(value){
	$('#'+this.inputFieldId()).val(value);
  }
  setEnabled(enabledValue){
	if(enabledValue){
		$('#'+this.inputFieldId()).prop('disabled',false);
	}else{
		$('#'+this.inputFieldId()).prop('disabled',true);
	}
  }
}