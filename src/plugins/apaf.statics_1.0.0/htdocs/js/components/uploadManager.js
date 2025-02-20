/*
 * uploadManager.js - APAF specialized component to manage file upload
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

/*
 * configuration: {
	"allowMultiple": true/false,
	"targetPath": "<workspace-relative-path>",
	"height": 300
   }
 */
apaf.UploadManager = class UploadManager extends NpaUiComponent{
	uploadLocation = null;
	enabled = true;
	initialize(then){
		$.loadCss('/resources/css/components/uploadManager.css',then);
	}
	render(then){
		let config = this.getConfiguration();
		if(this.parentDiv().data('loaded')!='true'){
			let component = this;
			// rely on the container to provide width
			let html = '<div id="'+this.getId()+'_component" class="uploadComponent">';
			html += '  <div id="'+this.getId()+'" class="uploadArea">';
			html += this.getLocalizedString('@apaf.component.upload.message');
			html += '  </div>';
			html += '  <div class="uploadSelector">';
			html += '    <div class="row">';
			html += '      <div class="col-10"><input id="'+this.getId()+'_manual" type="file" class="form-control form-control-sm"></div>';
			html += '      <div class="col-2">';
			html += '        <div class="d-grid gap-2 d-md-flex justify-content-md-end">';
			html += '          <button id="'+this.getId()+'_btn" type="button" class="btn btn-sm btn-secondary">'+this.getLocalizedString('@apaf.component.upload.manual')+'</button>';
			html += '        </div>';
			html += '      </div>';
			html += '    </div">';
			html += '  </div>';
			html += '</div>';
			this.parentDiv().html(html);
			
			let jQueryId = '#'+this.getId();
			if(typeof config.height!='undefined'){
				$(jQueryId).height(config.height);
				$(jQueryId).css('lineHeight',config.height+'px');
			}
			$(jQueryId).on('dragenter',function(ev){
				ev.stopPropagation();
				ev.preventDefault();
			});
			$(jQueryId).on('dragover',function(ev){
				ev.stopPropagation();
				ev.preventDefault();
			});
			$(jQueryId).on('drop',function(ev){
				ev.stopPropagation();
				ev.preventDefault();
				var dt = ev.dataTransfer;
				var files = dt.files;
				if(files && files.length>0 && component.enabled){
					if(config.allowMultiple){
						let uploadList = function(list,index,then){
							if(index<list.length){
								let file = list[index];
								$(jQueryId).html(component.getLocalizedString('@apaf.component.upload.uploading',[file.name]));
								component.uploadFile(component.getFilePath(),file,function(){
									uploadList(list,index+1,then);
								});
							}else{
								then();
							}
						}
						uploadList(files,0,function(){
							$(jQueryId).html(component.getLocalizedString('@apaf.component.upload.message'));
						});
					}else{
						let file = files[0];
						$(jQueryId).html(component.getLocalizedString('@apaf.component.upload.uploading',[file.name]));
						component.uploadFile(component.getFilePath(),file,function(){
							$(jQueryId).html(component.getLocalizedString('@apaf.component.upload.message'));
						});
					}
				}
		   });
		   $(jQueryId+'_btn').on('click',function(ev){
			 var file = $(jQueryId+'_manual').get(0).files[0];
			 $(jQueryId).html(component.getLocalizedString('@apaf.component.upload.uploading',[file.name]));
			 component.uploadFile(component.getFilePath(),file,function(){
				$(jQueryId).html(component.getLocalizedString('@apaf.component.upload.message'));
				$(jQueryId+'_manual').val('');
			 });
		   });
		}
		then();
	}
	getFilePath(){
		if(this.uploadLocation){
			return this.uploadLocation;
		}
		return this.getConfiguration().targetPath;
	}
	uploadFile(path,file,then){
		let component = this;
		var formdata = new FormData();
		formdata.append('data', file);
		apaf.upload(path,file.name,formdata)
			.then(function(res){
				if(200==res.status){
					npaUi.fireEvent('upload',{"source": component.getId(),"filename": file.name});
					then();
				}else{
					showError(JSON.stringify(res.message));
				}
			});
	}
	setPath(path){
		this.uploadLocation = path;
	}
	setEnabled(enabledState){
		this.enabled = enabledState;
		let jQueryId = '#'+this.getId();
		if(this.enabled){
			$(jQueryId+'_component').removeClass('uploadComponentDisabled');
			$(jQueryId+'_component').addClass('uploadComponent');
			$(jQueryId).html(this.getLocalizedString('@apaf.component.upload.message'));
			$(jQueryId+'_manual').prop('disabled',false);
			$(jQueryId+'_btn').prop('disabled',false);
		}else{
			$(jQueryId+'_component').removeClass('uploadComponent');
			$(jQueryId+'_component').addClass('uploadComponentDisabled');
			$(jQueryId).html(this.getLocalizedString('@apaf.component.upload.disabled'));
			$(jQueryId+'_manual').prop('disabled',true);
			$(jQueryId+'_btn').prop('disabled',true);
		}
	}
}