/*
 * sourceCodeEditor.js - APAF UI SourceCodeEditor component
 * Copyright 2026 Nicolas Renaudet - All rights reserved
 */
 
const DEPENDENCIES = [
	{"type": "css","uri": "/apaf-ui/css/sourceCodeEditor.css"}
]
 
if(typeof apafUi=='undefined'){
	apafUi = {};
}

/*
 * "configuration": {
		"label": "<button label>",
		"title": "<dialog title>",
        "listen": {
        	"source": "<event source component ID>",
        	"type": "<optional event type>",
        	"adapter": "<optional data adapter where the @ character represents the upper-level data>"
        },
        "editorConfig" = "<path-to-editor JSON configuration>",
        "activate": true/false
	}
 */
apafUi.SourceCodeEditor = class SourceCodeEditor extends NpaUiComponent{
	progress = 0;
	label = 'Click me!';
	title = 'Source Code Editor';
	source = null;
	adapterConfig = null;
	instanceCount = 0;
	initialize(then){
		loadDeps(DEPENDENCIES,then);
	}
	render(then){
		if(this.parentDiv().data('loaded')!='true'){
			let style = 'secondary';
			if(this.getConfiguration().buttonStyle){
				style = this.getConfiguration().buttonStyle;
			}
			let html = '';
			html += '<button id="'+this.getId()+'" type="button" class="btn btn-sm btn-'+style+' open-editor-button" disabled>'+this.getLabel()+'</button>';
			
			this.parentDiv().html(html);
			
			let component = this;
			
			$('#'+this.getId()).on('click',function(){
				component.openEditor();
			});
			
			if(this.getConfiguration().listen){
				this.configureListener(this.getConfiguration().listen);
			}
			
			if(this.getConfiguration().activate){
				this.enable(true);
			}
			
			then();
		}
	}
	configureListener(listenerConfig){
		if(listenerConfig){
			let editor = this;
			if(listenerConfig.source){
				if(listenerConfig.type){
					if('select'==listenerConfig.type){
						npaUi.registerSelectionListener(listenerConfig.source,editor);
						if(listenerConfig.adapter){
							this.adapterConfig = listenerConfig.adapter;
						}
					}	
				}else{
					let handleEvent = function(event){
						console.log('SourceCodeEditor#handleEvent()');
						if(listenerConfig.adapter){
							let sourceCode = '<put source code here>';
							let toEval = 'sourceCode = '+listenerConfig.adapter.replace(/@/g,'event')+';';
							try{
								eval(toEval);
							}catch(t){}
							
							editor.source = sourceCode;
						}else{
							editor.source = event.data;
						}
					}
					npaUi.on(listenerConfig.source,handleEvent);
				}
			}
		}
	}
	setEnable(enableStatus){
		if(enableStatus){
			$('#'+this.getId()).removeAttr('disabled');
		}else{
			$('#'+this.getId()).attr('disabled');
			$('#'+this.getId()).prop("disabled", true);
		}
	}
	onItemSelected(item){
		console.log('SourceCodeEditor#onItemSelected()');
		this.setEnable(false);
		if(this.adapterConfig){
			let sourceCode = '';
			let toEval = 'sourceCode = '+this.adapterConfig.replace(/@/g,'item')+';';
			try{
				eval(toEval);
			}catch(t){}
			this.source = sourceCode;
			if(typeof this.source=='undefined'){
				if(this.getConfiguration().defaultSource){
					this.source = this.getConfiguration().defaultSource;
				}else{
					this.source = '//put your code here'
				}
			}
		}else{
			this.source = item;
		}
	}
	setLabel(txt){
		this.label = txt;
		delete this.getConfiguration().label;
	}
	getLabel(){
		if(this.getConfiguration().label){
			return this.getConfiguration().label;
		}else{
			return this.label;
		}
	}
	getEditorConfigurationPath(){
		if(this.getConfiguration().editorConfig){
			return this.getConfiguration().editorConfig;
		}else{
			return DEFAULT_EDITOR_CONFIGURATION_PATH;
		}
	}
	getDialogTitle(){
		if(this.getConfiguration().dialogTitle){
			return this.getConfiguration().dialogTitle;
		}else{
			return this.title;
		}
	}
	getSource(){
		return this.source;
	}
	openEditor(){
		let component = this;
		let dialogTitle = apaf.localize(this.getDialogTitle());
		let dialog = apaf.createModalDialog({"size": "XXL","title": dialogTitle,"buttons": [
			{"action": "cancel","label": npaUi.getLocalizedString('@apaf.ui.component.dialog.cancel')},
			{"action": "close","label": npaUi.getLocalizedString('@apaf.ui.component.dialog.close')}
		]});
		let divId = this.getId()+'-'+this.instanceCount+'-div';
		let editorId = this.getId()+'-'+(this.instanceCount++)+'-editor';
		let html = '<div id="'+divId+'"></div>';
		dialog.setBody(html);
		dialog.setOnCloseCallback(function(){
			let editor = $apaf(editorId);
			component.source = editor.getText();
		});
		let editorConfiguration = {
			"id":editorId,
		    "version": "1.0.0",
		    "type": "Editor",
		    "configuration": {
		        "height": 800
		    }
		}
		npaUi.renderSingleComponent(divId,editorConfiguration,function(){
			let editor = $apaf(editorId);
			editor.setText(component.source);
			editor.setReadonly(false);
			dialog.open();
		});
	}
}