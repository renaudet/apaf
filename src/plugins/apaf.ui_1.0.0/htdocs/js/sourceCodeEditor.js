/*
 * sourceCodeEditor.js - APAF UI SourceCodeEditor component
 * Copyright 2026 Nicolas Renaudet - All rights reserved
 */
 
const DEPENDENCIES = [
	{"type": "css","uri": "/apaf-ui/css/sourceCodeEditor.css"}
]

const DEFAULT_SNIPPET_PROVIDER_URL = '/apaf-ui-support/codeEditor/snippets';
 
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
	editorId = null;
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
	getSnippetProviderUrl(){
		if(this.getConfiguration().snippetProviderUrl){
			return this.getConfiguration().snippetProviderUrl;
		}else{
			return DEFAULT_SNIPPET_PROVIDER_URL;
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
	handleEvent(event){
		console.log(event);
		if(event.source==this.editorId){
			this.openSnippetLibrary();	
		}
	}
	openEditor(){
		let component = this;
		let dialogTitle = apaf.localize(this.getDialogTitle());
		let dialog = apaf.createModalDialog({"size": "XXL","title": dialogTitle,"buttons": [
			{"action": "cancel","label": npaUi.getLocalizedString('@apaf.ui.component.dialog.cancel')},
			{"action": "close","label": npaUi.getLocalizedString('@apaf.ui.component.dialog.close')}
		]});
		let divId = this.getId()+'-'+this.instanceCount+'-div';
		this.editorId = this.getId()+'-'+(this.instanceCount++)+'-editor';
		let editorButtonActionId = this.getId()+'ActionButtonClick';
		let html = '<div id="'+divId+'"></div>';
		dialog.setBody(html);
		dialog.setOnCloseCallback(function(){
			let editor = $apaf(component.editorId);
			component.source = editor.getText();
		});
		let editorConfiguration = {
			"id": component.editorId,
		    "version": "1.0.0",
		    "type": "Editor",
		    "configuration": {
		        "height": 800,
		        "toolbar": {
		        	"position": "top",
		        	"actions": [
		        		{
		                    "label": "Snippets Library",
		                    "actionId": editorButtonActionId,
		                    "icon": "/uiTools/img/silk/folder_page_white.png",
			                "enabled": true,
			                "enableOnSelection": true
		                }
		            ]
		        }
		    }
		}
		npaUi.registerActionHandler(editorButtonActionId,this);
		npaUi.renderSingleComponent(divId,editorConfiguration,function(){
			let editor = $apaf(component.editorId);
			editor.setText(component.source);
			editor.setReadonly(false);
			dialog.open();
		});
	}
	openSnippetLibrary(){
		let component = this;
		let selectId = this.getId()+'-'+this.instanceCount+'-select';
		let snippetDialogTitle = 'Snippet Library';
		let snippetDialog = apaf.createModalDialog({"size": "XXL","title": snippetDialogTitle,"buttons": [
			{"action": "cancel","label": npaUi.getLocalizedString('@apaf.ui.component.dialog.cancel')},
			{"action": "close","label": npaUi.getLocalizedString('@apaf.ui.component.dialog.close')}
		]});
		let html = '';
		html += '<div>';
		html += '  <select id="'+selectId+'" class="form-control form-control-sm">';
		html += '    <option value="">-- Please, select --</option>';
		html += '  </select>';
		html += '</div>';
		html += '<div id="snippet" style="min-height: 400px;overflow: auto;font-family: lucida console;font-size: 0.9rem;background-color: #000000;color: #00ff00;">';
		html += '</div>';
		snippetDialog.setBody(html);
		apaf.call({
			"method": "GET",
			"uri": component.getSnippetProviderUrl(),
			"payload": {}
		}).then(function(data){
			if(data && data.length>0){
				let snippets = sortOn(data,'category');
				let category = '';
				let optGroupId = null;
				for(var i=0;i<snippets.length;i++){
					let snippetEntry = snippets[i];
					if(snippetEntry.category!=category){
						category = snippetEntry.category;
						optGroupId = selectId+'_snippetCategory_'+i;
						let optGroup = '<optgroup id="'+optGroupId+'" label="'+category+'"></optgroup>';
						$('#'+selectId).append(optGroup);
					}
					let option = '';
					option += '<option value="';
					option += snippetEntry.location;
					option += '">';
					option += snippetEntry.label;
					option += '</option>';
					//$('#snippetSelector').append(option);
					$('#'+optGroupId).append(option);
				}
			}
			snippetDialog.open();
		}).onError(function(msg){
			showError(msg);
		});
		
		snippetDialog.setOnCloseCallback(function(){
			let snippetSource = $('#snippet pre').text();
			let editor = $apaf(component.editorId).editor;
		    var doc = editor.getDoc();
		    var cursor = doc.getCursor();
		    doc.replaceRange(snippetSource, cursor);
		});
		
		$('#'+selectId).off('.code-editor');
		$('#'+selectId).on('click.code-editor',function(){
			$('#snippet').empty();
			let selectedValue = $('#'+selectId).val();
			if(selectedValue && selectedValue.length>0){
				$.ajax({
			        url: selectedValue,
			        dataType: 'text',
			        async: true,
			        success: function(){
					}
			    }).done(function(txt){
					$('#snippet').append('<pre>'+txt.replace(/</g,'&lt;').replace(/\t/g,'&nbsp;&nbsp;&nbsp;')+'</pre>');
				});
		    }
		});
	}
}