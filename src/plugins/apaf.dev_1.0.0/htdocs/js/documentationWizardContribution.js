/*
 * documentationWizardContribution.js - an inline Documentation Wizard for APAF Fragment development
 */
const DOC_WIZARD_NAMESPACE = '.apaf_docs_wizard';
const DOC_WIZARD_BUTTON_CONFIG = {
	"label": "Documentation",
	"icon": "/uiTools/img/silk/book_open.png",
	"actionId": "openDocumentationDialog"
}

contributeWizard = function(){
	let form = $apaf(EDIT_FORM_ID);
	let editor = form.getFieldEditor(SOURCE_CODE_FIELD_NAME);
	editor.addButton(DOC_WIZARD_BUTTON_CONFIG);
	npaUi.on('openDocumentationDialog',openDocumentationDialog);
}

openDocumentationDialog = function(){
	let dialog = $apaf(EMPTY_DIALOG_ID);
	dialog.setTitle('APAF Documentation');
	let html = '<div id="pageList" class="list-group" style="min-height: 400px;max-height: 600px;overflow: auto;"></div>';
	
	dialog.setBody(html);
	$('.documentation-page-link').off(DOC_WIZARD_NAMESPACE);
	apaf.call({"method": "GET","uri": "/apaf-dev/docs","payload": {}})
		.then(function(docPages){
			for(var i=0;i<docPages.length;i++){
				let page = docPages[i];
				let listItem = '  <a href="#" class="list-group-item list-group-item-action documentation-page-link" data-page-url="'+page.page+'">'+page.description+'</a>';
				$('#pageList').append(listItem);
			}
			$('.documentation-page-link').on('click',function(){
				let url = $(this).data('page-url');
				console.log('url: '+url);
				window.open(url,'_apaf_documentation','popup');
			});
			dialog.open();
		})
		.onError(function(msg,details){
			showError(msg);
			console.log(details);
		});
}

contributeWizard();