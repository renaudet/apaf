if(typeof apafEditors=='undefined'){
	apafEditors = {};
}

apafEditors.generatedFieldEditorCount = 0;

apafEditors.GeneratedFieldEditor = class GeneratedFieldEditor extends PluggableEditor {
	enabled = false;
	render(then){
		let baseId = this.inputFieldId();
		this.uuid = baseId+'_'+(apafEditors.generatedFieldEditorCount++);
		let editor = this;
		let html = '';
	    html += '<div class="input-group mb-3">';
	    html += '  <input id="'+baseId+'" type="text" class="form-control" placeholder="generated API key" readonly disabled>';
	    html += '  <button class="btn btn-outline-secondary" type="button" id="'+this.uuid+'_copy_button" disabled><img src="/uiTools/img/silk/page_copy.png" title="Copy key to clipboard"></button>';
	    html += '  <button class="btn btn-outline-secondary" type="button" id="'+this.uuid+'_get_button" disabled><img src="/uiTools/img/silk/key_add.png" title="Request a new key"></button>';
	    html += '  <button class="btn btn-outline-secondary" type="button" id="'+this.uuid+'_delete_button" disabled><img src="/uiTools/img/silk/key_delete.png" title="Remove key"></button>';
	    html += '</div>';
	    if(this.getConfig().help){
			let inputFieldId = this.field.baseId+'_'+this.field.config.name;
			html += '<div class="collapse" id="'+inputFieldId+'_help">';
			html += '  <div class="card card-body form-help">'+this.field.getLocalizedString(this.getConfig().help)+'</div>';
			html += '</div>';
		}
	    this.getSite().append(html);
	    $('#'+this.uuid+'_get_button').on('click',function(){
			editor.getGeneratedValue();
		});
	    $('#'+this.uuid+'_delete_button').on('click',function(){
			editor.deleteGeneratedValue();
		});
	    $('#'+this.uuid+'_copy_button').on('click',function(){
			navigator.clipboard.writeText(editor.getValue());
			flash('API Key copied to clipboard');
		});
	    then();
	}
	inputFieldId(){
		return this.field.form.getId()+'_'+this.getConfig().name;
	}
	getValue(){
		return $('#'+this.inputFieldId()).val();
	}
	setValue(value){
		$('#'+this.inputFieldId()).val(value?value:'');
		if(this.enabled){
			if(value && value.length>0){
				$('#'+this.uuid+'_get_button').prop('disabled',true);
				$('#'+this.uuid+'_delete_button').prop('disabled',false);
				$('#'+this.uuid+'_copy_button').prop('disabled',false);
			}else{
				$('#'+this.uuid+'_get_button').prop('disabled',false);
				$('#'+this.uuid+'_delete_button').prop('disabled',true);
				$('#'+this.uuid+'_copy_button').prop('disabled',true);
			}
		}else{
			if(value && value.length>0){
				$('#'+this.uuid+'_copy_button').prop('disabled',false);
			}else{
				$('#'+this.uuid+'_copy_button').prop('disabled',true);
			}
			$('#'+this.inputFieldId()).prop('disabled',true);
			$('#'+this.uuid+'_get_button').prop('disabled',true);
			$('#'+this.uuid+'_delete_button').prop('disabled',true);
		}
	}
	setEnabled(enabledValue){
		this.enabled = enabledValue;
		if(this.enabled){
			$('#'+this.inputFieldId()).prop('disabled',false);
			$('#'+this.uuid+'_get_button').prop('disabled',false);
			if(this.getValue().length>0){
				$('#'+this.uuid+'_copy_button').prop('disabled',false);
				$('#'+this.uuid+'_delete_button').prop('disabled',false);
			}
		}else{
			$('#'+this.inputFieldId()).prop('disabled',true);
			$('#'+this.uuid+'_get_button').prop('disabled',true);
			$('#'+this.uuid+'_delete_button').prop('disabled',true);
			$('#'+this.uuid+'_copy_button').prop('disabled',true);
		}
	}
	deleteGeneratedValue(){
		this.setValue(undefined);
	}
	getGeneratedValue(){
		let editor = this;
		apaf.call({"uri": this.getConfig().endpoint})
		    .then(function(response){
				let value = '';
				let toEval = 'value = '+editor.getConfig().responseAdapter.replace(/@/g,'response')+';';
				console.log('String to evaluate: '+toEval);
				try{
					eval(toEval);
					editor.setValue(response.key);
				}catch(t){
					showWarning('Response adapter evaluation failed in GeneratedFieldEditor for field name '+editor.getConfig().name);
					editor.setValue('####');
				}
			})
			.onError(function(errorMsg){
				showError(errorMsg.message?errorMsg.message:errorMsg);
			});
	}
}