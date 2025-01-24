/*
 * form.js - NPA UI Tools Core component framework's Form component'
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
class FormField {
	config = null;
	form = null;
	baseId = '';
	editable = true;
	hidden = false;
	constructor(config,form){
		this.config = config;
		this.form = form;
	}
	render(parent){
		this.baseId = parent.prop('id');
	}
	setFocus(){
	}
	setEditMode(editable){
		this.editable = editable;
		this.setEnabled(editable);
	}
	setEnabled(enabled){}
	show(){}
	hide(){
		this.setEditMode(false);
	}
	setData(parentObj){}
	val(value){
		let data = {};
		data[this.config.name] = value;
		this.setData(data);
	}
	assignData(parentObj){
	}
	vetoRaised(){
		return false;
	}
	getLocalizedString(reference,data=[]){
		return this.form.getLocalizedString(reference,data);
	}
	fireFormEvent(event){
		this.form.fireFormEvent(event);
	}
	onFormEvent(event){
		console.log('field '+this.config.name+' received event '+event.type+' from '+event.source);
		if(typeof this.config.constraint!='undefined' && this.config.constraint.length>0){
			if(typeof this.config.constrainedBy=='undefined' || 
			   (this.config.constrainedBy.length>0 && this.config.constrainedBy==event.source) || 
			   'editionStatusChanged'==event.type){
				console.log('evaluating constraint '+this.config.constraint);
				try{
					let virtualData = this.form.getData();
					let toEval = this.config.constraint.replace(/@/g,'virtualData').replace(/#/g,'this')+';';
					console.log(toEval);
					eval(toEval);
					console.log('evaluation successfull');
				}catch(e){
					console.log('Form#Field('+this.config.name+')#onFormEvent() caught an evaluation exception');
					console.log(e);
				}
			}
		}
	}
}

class LabeledFormField extends FormField{
	constructor(config,form){
		super(config,form);
	}
	generateLabel(){
		var html = '';
		html += '<div class="col-2 form-row-label">';
		if(typeof this.config.label!='undefined' && this.config.label.length>0){
			html += this.getLocalizedString(this.config.label);
			if(this.config.isIdField){
				html += '&nbsp;<span style="color: red;">*</span>';
			}
			html += ':';
		}
		if(this.config.help){
			html += '<button class="btn btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#'+this.baseId+'_'+this.config.name+'_help"><img src="/uiTools/img/silk/information.png" title="help" style="padding-bottom: 5px;"></button>';
		}
		html += '</div>';
		return html;
	}
}

class TextField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		let html = '';
		let placeholder = '';
		if(typeof this.config.placeholder!='undefined'){
			placeholder = this.config.placeholder;
		}
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-'+this.config.size+'">';
		html += '    <input type="text" id="'+inputFieldId+'" class="form-control-plaintext" placeholder="'+this.getLocalizedString(placeholder)+'" readonly>';
		if(this.config.help){
			html += '<div class="collapse" id="'+inputFieldId+'_help">';
			html += '  <div class="card card-body form-help">'+this.getLocalizedString(this.config.help)+'</div>';
			html += '</div>';
		}
		html += '  </div>';
		if(this.config.size<10){
			html += '  <div class="col-'+(10-this.config.size)+'">&nbsp;</div>';
		}
		html += '</div>';
		parent.append(html);
		let field = this;
		$('#'+inputFieldId).on('input',function(){
			field.fireFormEvent({"type": "change","source": field.config.name});
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		let inputFieldId = this.baseId+'_'+this.config.name;
		if(editing){
			$('#'+inputFieldId).addClass('form-control');
			$('#'+inputFieldId).removeClass('form-control-plaintext');
			$('#'+inputFieldId).removeAttr('readonly');
		}else{
			$('#'+inputFieldId).removeClass('form-control');
			$('#'+inputFieldId).addClass('form-control-plaintext');
			$('#'+inputFieldId).attr('readonly');
		}
	}
	setFocus(){
		let inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId).focus();
	}
	setData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		if(parentObj[this.config.name]){
			$('#'+inputFieldId).val(parentObj[this.config.name]);
		}else{
			if(this.config.default && this.config.default.length>0){
				$('#'+inputFieldId).val(this.config.default);
			}else{
				$('#'+inputFieldId).val('');
			}
		}
		$('#'+inputFieldId).removeClass('is-invalid');
	}
	assignData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		parentObj[this.config.name] = $('#'+inputFieldId).val();
	}
	vetoRaised(){
		var inputFieldId = this.baseId+'_'+this.config.name;
		var fieldValue = $('#'+inputFieldId).val();
		if(this.config.required && (typeof fieldValue=='undefined' || fieldValue.length==0)){
			$('#'+inputFieldId).addClass('is-invalid');
			$('#'+inputFieldId).focus();
			showError(this.getLocalizedString('@form.textField.error',[this.config.name]));
			return true;
		}else{
			$('#'+inputFieldId).removeClass('is-invalid');
			return false;
		}
	}
}

class PasswordField extends TextField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		let html = '';
		let placeholder = '';
		if(typeof this.config.placeholder!='undefined'){
			placeholder = this.config.placeholder;
		}
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-'+this.config.size+'">';
		html += '    <input type="password" id="'+inputFieldId+'" class="form-control-plaintext" placeholder="'+placeholder+'" readonly>';
		if(this.config.help){
			html += '<div class="collapse" id="'+inputFieldId+'_help">';
			html += '  <div class="card card-body form-help">'+this.getLocalizedString(this.config.help)+'</div>';
			html += '</div>';
		}
		html += '  </div>';
		if(this.config.size<10){
			html += '  <div class="col-'+(10-this.config.size)+'">&nbsp;</div>';
		}
		html += '</div>';
		parent.append(html);
		let field = this;
		$('#'+inputFieldId).on('input',function(){
			field.fireFormEvent({"type": "change","source": field.config.name});
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setData(parentObj){
		if('password'==this.config.type){
			super.setData(parentObj);
		}
		if('passwordCheck'==this.config.type){
			var inputFieldId = this.baseId+'_'+this.config.name;
			var checkedValue = parentObj[this.config.checkField];
			if(typeof checkedValue!='undefined'){
				$('#'+inputFieldId).val(checkedValue);
			}else{
				$('#'+inputFieldId).val('');
			}
			$('#'+inputFieldId).removeClass('is-invalid');
		}
	}
	assignData(parentObj){
		if('password'==this.config.type){
			var inputFieldId = this.baseId+'_'+this.config.name;
			parentObj[this.config.name] = $('#'+inputFieldId).val();
		}
	}
	vetoRaised(){
		var inputFieldId = this.baseId+'_'+this.config.name;
		if('password'==this.config.type){
			var fieldValue = $('#'+inputFieldId).val();
			if(this.config.required && (typeof fieldValue=='undefined' || fieldValue.length==0)){
				$('#'+inputFieldId).addClass('is-invalid');
				$('#'+inputFieldId).focus();
				showError(this.getLocalizedString('@form.textField.error',[this.config.name]));
				return true;
			}else{
				if((this.config.required && this.config.minimumLength && fieldValue.length<this.config.minimumLength) ||
				   (!this.config.required && this.config.minimumLength && fieldValue.length>0 && fieldValue.length<this.config.minimumLength)){
					$('#'+inputFieldId).addClass('is-invalid');
					$('#'+inputFieldId).focus();
					showError(this.getLocalizedString('@form.passwordField.error.length',[this.config.name,this.config.minimumLength]));
					return true;
				}else{
					$('#'+inputFieldId).removeClass('is-invalid');
					return false;
				}
			}
		}
		if('passwordCheck'==this.config.type){
			var fieldValue = $('#'+inputFieldId).val();
			var checkedFieldValue = $('#'+this.baseId+'_'+this.config.checkField).val();
			if((this.config.required && fieldValue!=checkedFieldValue) ||
			    (checkedFieldValue.length>0 && fieldValue!=checkedFieldValue)){
				$('#'+inputFieldId).addClass('is-invalid');
				$('#'+inputFieldId).focus();
				$('#'+this.baseId+'_'+this.config.checkField).addClass('is-invalid');
				showError(this.getLocalizedString('@form.passwordField.error.match'));
				return true;
			}else{
				$('#'+inputFieldId).removeClass('is-invalid');
				$('#'+this.baseId+'_'+this.config.checkField).removeClass('is-invalid');
				return false;
			}
		}
		return true;
	}
}

class UrlField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		let html = '';
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-10">';
		html += '    <input type="text" id="'+inputFieldId+'" class="form-control-plaintext" readonly><span id="'+inputFieldId+'_link" style="display: none;"></span>';
		html += '  </div>';
		html += '</div>';
		parent.append(html);
		let field = this;
		$('#'+inputFieldId).on('input',function(){
			field.fireFormEvent({"type": "change","source": field.config.name});
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	showLink(){
		let inputFieldId = '#'+this.baseId+'_'+this.config.name;
		let inputFielLinkId = '#'+this.baseId+'_'+this.config.name+'_link';
		let urlValue = $(inputFieldId).val();
		$(inputFielLinkId).html('<a href="'+urlValue+'" target="_other">'+urlValue+'</a>');
		$(inputFielLinkId).css('display','inline');
		$(inputFieldId).css('display','none');
	}
	hideLink(){
		let inputFieldId = '#'+this.baseId+'_'+this.config.name;
		let inputFielLinkId = '#'+this.baseId+'_'+this.config.name+'_link';
		$(inputFielLinkId).css('display','none');
		$(inputFieldId).css('display','inline');
	}
	setEnabled(editing){
		let inputFieldId = this.baseId+'_'+this.config.name;
		if(editing){
			$('#'+inputFieldId).addClass('form-control');
			$('#'+inputFieldId).removeClass('form-control-plaintext');
			$('#'+inputFieldId).removeAttr('readonly');
			this.hideLink();
		}else{
			$('#'+inputFieldId).removeClass('form-control');
			$('#'+inputFieldId).addClass('form-control-plaintext');
			$('#'+inputFieldId).attr('readonly');
			this.showLink();
		}
	}
	setFocus(){
		let inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId).focus();
	}
	setData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		if(parentObj[this.config.name]){
			$('#'+inputFieldId).val(parentObj[this.config.name]);
		}else{
			if(this.config.default && this.config.default.length>0){
				$('#'+inputFieldId).val(this.config.default);
			}else{
				$('#'+inputFieldId).val('');
			}
		}
		$('#'+inputFieldId).removeClass('is-invalid');
		let inputFielLinkId = '#'+this.baseId+'_'+this.config.name+'_link';
		let urlValue = $('#'+inputFieldId).val();
		console.log('urlValue: '+urlValue);
		$(inputFielLinkId).html('<a href="'+urlValue+'" target="_other">'+urlValue+'</a>');
	}
	assignData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		parentObj[this.config.name] = $('#'+inputFieldId).val();
	}
	vetoRaised(){
		var inputFieldId = this.baseId+'_'+this.config.name;
		var fieldValue = $('#'+inputFieldId).val();
		if(this.config.required && (typeof fieldValue=='undefined' || fieldValue.length==0) && !fieldValue.startsWith('http')){
			$('#'+inputFieldId).addClass('is-invalid');
			$('#'+inputFieldId).focus();
			showError(this.getLocalizedString('@form.textField.error',[this.config.name]));
			return true;
		}else{
			$('#'+inputFieldId).removeClass('is-invalid');
			return false;
		}
	}
}

class NumericField extends TextField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		let html = '';
		let placeholder = '';
		if(typeof this.config.placeholder!='undefined'){
			placeholder = this.config.placeholder;
		}
		let size = 3;
		if(typeof this.config.size!='undefined'){
			size = this.config.size;
		}
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-'+size+'">';
		html += '    <input type="number" id="'+inputFieldId+'" class="form-control-plaintext" placeholder="'+placeholder+'" value="'+this.config.default+'" readonly>';
		if(this.config.help){
			html += '<div class="collapse" id="'+inputFieldId+'_help">';
			html += '  <div class="card card-body form-help">'+this.getLocalizedString(this.config.help)+'</div>';
			html += '</div>';
		}
		html += '  </div>';
		if(size<10){
			html += '  <div class="col-'+(10-size)+'">&nbsp;</div>';
		}
		html += '</div>';
		parent.append(html);
		let field = this;
		$('#'+inputFieldId).on('input',function(){
			field.fireFormEvent({"type": "change","source": field.config.name});
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		if(Number.isInteger(parentObj[this.config.name])){
			$('#'+inputFieldId).val(parentObj[this.config.name]);
			$('#'+inputFieldId).removeClass('is-invalid');
		}else{
			if(typeof this.config.default!='undefined'){
				$('#'+inputFieldId).val(this.config.default);
				$('#'+inputFieldId).removeClass('is-invalid');
			}else{
				$('#'+inputFieldId).addClass('is-invalid');
			}
		}
	}
	assignData(parentObj){
		const parsed = parseInt($('#'+this.baseId+'_'+this.config.name).val(), 10);
		if (isNaN(parsed)){
			parentObj[this.config.name] = typeof this.config.default=='undefined'?0:this.config.default;
		}else{
			parentObj[this.config.name] = parsed;
		}
	}
	vetoRaised(){
		console.log('NumericField#vetoRaised()');
		console.log(this.config);
		var inputFieldId = this.baseId+'_'+this.config.name;
		var fieldValue = $('#'+inputFieldId).val();
		const parsed = parseInt(fieldValue, 10);
		if(this.config.required && isNaN(parsed)){
			$('#'+inputFieldId).addClass('is-invalid');
			$('#'+inputFieldId).focus();
			showError(this.getLocalizedString('@form.numericField.error',[this.config.name]));
			return true;
		}else{
			$('#'+inputFieldId).removeClass('is-invalid');
			return false;
		}
	}
}

const DATE_PICKER_DEPTS = [
	{"type": "css","uri": "/css/bootstrap-datepicker.standalone.css"},
	{"type": "js","uri": "/js/bootstrap-datepicker.js"},
	{"type": "js","uri": "/js/moment.min.js"}
]

class DateField extends TextField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		var size = typeof this.config.size!='undefined'?this.config.size:3;
		var html = '';
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-'+size+'">';
		html += '    <input type="text" id="'+inputFieldId+'" class="form-control-plaintext" style="'+this.config.style+'" placeholder="YYYY/MM/DD" data-provide="datepicker" data-date-format="yyyy/mm/dd" readonly>';
		if(this.config.help){
			html += '<div class="collapse" id="'+inputFieldId+'_help">';
			html += '  <div class="card card-body form-help">'+this.getLocalizedString(this.config.help)+'</div>';
			html += '</div>';
		}
		html += '  </div>';
		if(size<10){
			html += '  <div class="col-'+(10-size)+'">&nbsp;</div>';
		}
		html += '</div>';
		parent.append(html);
		var target = this;
		loadDeps(DATE_PICKER_DEPTS,function(){
			  $('#'+inputFieldId).val(moment().format('YYYY/MM/DD'));
		});
		let field = this;
		$('#'+inputFieldId).on('change',function(){
			field.fireFormEvent({"type": "change","source": field.config.name});
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	vetoRaised(){
		var inputFieldId = this.baseId+'_'+this.config.name;
		var fieldValue = $('#'+inputFieldId).val();
		if(this.config.required && (typeof fieldValue=='undefined' || fieldValue.length<10 || fieldValue.indexOf('/')<0)){
			$('#'+inputFieldId).addClass('is-invalid');
			$('#'+inputFieldId).focus();
			showError(this.getLocalizedString('@form.dateField.error',[this.config.name]));
			return true;
		}else{
			$('#'+inputFieldId).removeClass('is-invalid');
			return false;
		}
	}
}

class CheckField extends FormField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		var html = '';
		var divClass = ' form-check';
		var role = '';
		var checkClass = ' form-checkbox';
		if(this.config.type=='switch'){
			divClass += ' form-switch';
			role = ' role="switch"';
			checkClass = '';
		}
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += '  <div class="col-2">&nbsp;</div>';
		html += '  <div class="col-9'+divClass+'">';
		html += '    <input type="checkbox" id="'+inputFieldId+'"'+role+' disabled class="form-check-input'+checkClass+'" style="margin-left: -10px;margin-right: 8px;" value="true"'+(this.config.default?' checked>':'>');
		html += '    <label class="form-check-label" for="'+inputFieldId+'">';
		html += this.getLocalizedString(this.config.label);
		if(this.config.help){
			html += '<button class="btn btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#'+inputFieldId+'_help"><img src="/uiTools/img/silk/information.png" title="help" style="padding-bottom: 5px;"></button>';
		}
		html += '    </label>';
		if(this.config.help){
			html += '<div class="collapse" id="'+inputFieldId+'_help">';
			html += '  <div class="card card-body form-help">'+this.getLocalizedString(this.config.help)+'</div>';
			html += '</div>';
		}
		html += '  </div>';
		html += '  <div class="col-1">&nbsp;</div>';
		html += '</div>';
		parent.append(html);
		let field = this;
		$('#'+inputFieldId).on('change',function(){
			field.fireFormEvent({"type": "change","source": field.config.name});
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		let inputFieldId = this.baseId+'_'+this.config.name;
		if(editing){
			$('#'+inputFieldId).prop('disabled',false);
		}else{
			$('#'+inputFieldId).prop('disabled',true);
		}
	}
	setFocus(){
		let inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId).focus();
	}
	setData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		if(typeof parentObj[this.config.name]!='undefined'){
			if(parentObj[this.config.name]){
				$('#'+inputFieldId).prop('checked',true);
			}else{
				$('#'+inputFieldId).prop('checked',false);
			}
		}else{
			if(typeof this.config.default!='undefined'){
				$('#'+inputFieldId).prop('checked',this.config.default);
			}else{
				$('#'+inputFieldId).prop('checked',false);
			}
		}
	}
	assignData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		var checked = $('#'+inputFieldId).prop('checked');
		parentObj[this.config.name] = checked;
	}
	vetoRaised(){
		return false;
	}
}

class RadioField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		var html = '';
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-9 form-check">';
		for(var i=0;i<this.config.choices.length;i++){
			var choice = this.config.choices[i];
			html += '<div>';
			html += '<input class="form-check-input" type="radio" style="margin-left: -10px;margin-right: 7px;" name="'+inputFieldId+'" id="'+inputFieldId+'_'+i+'"';
			if(choice.value==this.config.default){
				html += ' checked';
			}
			html += ' value="'+choice.value+'"';
			html += ' disabled>';
			html += '<label class="form-check-label" for="'+inputFieldId+'_'+i+'">';
			html += this.getLocalizedString(choice.label);
			html += '</label>';
			html += '</div>';
		}
		html += '  </div>';
		html += '  <div class="col-1">&nbsp;</div>';
		html += '</div>';
		parent.append(html);
		let field = this;
		$('[name="'+inputFieldId+'"]').on('change',function(){
			field.fireFormEvent({"type": "change","source": field.config.name});
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		let inputFieldId = this.baseId+'_'+this.config.name;
		if(editing){
			$('input[name='+inputFieldId+']').prop('disabled',false);
		}else{
			$('input[name='+inputFieldId+']').prop('disabled',true);
		}
	}
	setFocus(){
	}
	setData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		if(typeof parentObj[this.config.name]!='undefined' && parentObj[this.config.name]){
			$('input[name='+inputFieldId+'][value=\''+parentObj[this.config.name]+'\']').prop('checked',true);
		}else{
			$('input[name='+inputFieldId+'][value=\''+this.config.default+'\']').prop('checked',true);
		}
	}
	assignData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		parentObj[this.config.name] = $('input[name='+inputFieldId+']:checked').val();
	}
	vetoRaised(){
		return false;
	}
}

class ColorPickerField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		var html = '';
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-10">';
		html += '    <input type="color" name="'+inputFieldId+'" id="'+inputFieldId+'" class="form-control form-control-color" value="'+this.config.default+'" title="Click to choose a color" disabled>';
		if(this.config.help){
			html += '<div class="collapse" id="'+inputFieldId+'_help">';
			html += '  <div class="card card-body form-help">'+this.getLocalizedString(this.config.help)+'</div>';
			html += '</div>';
		}
		html += '  </div>';
		html += '</div>';
		parent.append(html);
		let field = this;
		$('#'+inputFieldId).on('change',function(){
			field.fireFormEvent({"type": "change","source": field.config.name});
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		let inputFieldId = this.baseId+'_'+this.config.name;
		if(editing){
			$('input[name='+inputFieldId+']').prop('disabled',false);
		}else{
			$('input[name='+inputFieldId+']').prop('disabled',true);
		}
	}
	setFocus(){
		let inputFieldId = this.baseId+'_'+this.config.name;
		$('input[name='+inputFieldId+']').focus();
	}
	setData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		if(typeof parentObj[this.config.name]!='undefined' && parentObj[this.config.name]){
			$('input[name='+inputFieldId+']').val(parentObj[this.config.name]);
		}else{
			$('input[name='+inputFieldId+']').val(this.config.default);
		}
	}
	assignData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		parentObj[this.config.name] = $('input[name='+inputFieldId+']').val();
	}
	vetoRaised(){
		return false;
	}
}

class RangeSelectorField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		let html = '';
		let size = 10;
		if(typeof this.config.size!='undefined'){
			size = this.config.size;
		}
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-'+size+'">';
		html += '    <input type="range" id="'+inputFieldId+'" name="'+inputFieldId+'" class="form-range form-slider" value="'+this.config.default+'" min="'+this.config.min+'" max="'+this.config.max+'" step="'+this.config.step+'" disabled>';
		if(this.config.help){
			html += '<div class="collapse" id="'+inputFieldId+'_help">';
			html += '  <div class="card card-body form-help">'+this.getLocalizedString(this.config.help)+'</div>';
			html += '</div>';
		}
		html += '  </div>';
		if(size<10){
			html += '  <div class="col-'+(10-size)+'"><span id="'+inputFieldId+'_value" class="form-text">'+this.config.default+'</span></div>';
		}
		html += '</div>';
		parent.append(html);
		var source = this;
		$('input[name='+inputFieldId+']').on('input',function(){
			source.displayValue();
			source.fireFormEvent({"type": "change","source": source.config.name});
		});
	}
	displayValue(){
		let inputFieldId = this.baseId+'_'+this.config.name;
		if(this.config.renderer){
			let fieldValue = $('#'+inputFieldId).val();
			let displayValue = fieldValue;
			let toEval = 'displayValue = '+this.config.renderer.replace(/@/g,'fieldValue')+';';
			try{
				eval(toEval);
			}catch(t){
				console.log(toEval);
				console.log(t);
			}
			finally{
				$('#'+inputFieldId+'_value').html(displayValue);
			}
		}else{
			$('#'+inputFieldId+'_value').html($('#'+inputFieldId).val());
		}
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		let inputFieldId = this.baseId+'_'+this.config.name;
		if(editing){
			$('input[name='+inputFieldId+']').prop('disabled',false);
		}else{
			$('input[name='+inputFieldId+']').prop('disabled',true);
		}
	}
	setFocus(){
		let inputFieldId = this.baseId+'_'+this.config.name;
		$('input[name='+inputFieldId+']').focus();
	}
	setData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		if(Number.isInteger(parentObj[this.config.name])){
			$('input[name='+inputFieldId+']').val(parentObj[this.config.name]);
		}else{
			$('input[name='+inputFieldId+']').val(this.config.default);
		}
		this.displayValue();
	}
	assignData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		parentObj[this.config.name] = parseInt($('input[name='+inputFieldId+']').val());
	}
	vetoRaised(){
		return false;
	}
}

class SelectField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	fetchDataFromDatasource(then){
		let datasource = this.config.datasource;
		if(typeof datasource!='undefined'){
			let type = 'local';
			let method = 'GET';
			let payload = {};
			if(typeof datasource.type!='undefined'){
				type = datasource.type;
			}
			if(typeof datasource.method!='undefined'){
				method = datasource.method;
			}
			if(typeof datasource.payload!='undefined'){
				payload = datasource.payload;
			}
			if('local'==type){
				console.log('SelectField#fetchDataFromDatasource() - using local data from '+datasource.uri);
				var field = this;
				makeRESTCall(method,datasource.uri,payload,function(response){
					if(response.status==200){
						then(field.adaptFormat(response));
					}else{
						console.log(response);
					}
				},function(errorMsg){
					console.log(errorMsg);
				});
			}
			if('managed'==type){
				console.log('SelectField#fetchDataFromDatasource() - using DataManager #'+datasource.manager);
				let dataManager = npaUi.getComponent(datasource.manager);
				if(typeof dataManager!='undefined'){
					dataManager.query(payload).then(function(data){
						if(datasource.adapter){
							var adaptedData = [];
							var toEval = 'adaptedData = '+datasource.adapter.replace(/@/g,'data')+';'
							try{
								eval(toEval);
								then(adaptedData);
							}catch(t){
								console.log('SelectField#fetchDataFromDatasource(data) - exception evaluating adapter for datasource');
								then([]);
							}
						}else{
							then(data);
						}
					});
				}else{
					console.log('dataManager '+datasource.manager+' not found in context');
				}
			}
		}
	}
	adaptFormat(inputData){
		let datasource = this.config.datasource;
		let dsType = 'local';
		if(typeof datasource.type!='undefined'){
			dsType = datasource.type;
		}
		if('local'==dsType){
			if(datasource.adapter){
				var data = [];
				var toEval = 'data = '+datasource.adapter.replace(/@/g,'inputData')+';'
				try{
					eval(toEval);
					return data;
				}catch(t){
					console.log('SelectField#adaptFormat(inputData) - exception evaluating adapter for datasource');
					return [];
				}
			}else{
				return inputData;
			}
		}
		console.log('SelectField#adaptFormat(inputData) - no adapter configured for datasource type '+dsType);
		return [];
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		let html = '';
		let size = 8;
		if(typeof this.config.size!='undefined'){
			size = this.config.size;
		}
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-'+size+'">';
		html += '    <select id="'+inputFieldId+'" class="form-select" disabled>';
		if(!this.config.required){
			html += '<option value="">'+this.getLocalizedString('@form.selectField.select.value')+'</option>';
		}
		if(typeof this.config.values!='undefined'){
			for(var i=0;i<this.config.values.length;i++){
				var value = this.config.values[i];
				if(typeof value.label!='undefined'){
					html += '<option value="';
					html += value.value;
					html += '">';
					html += this.getLocalizedString(value.label);
					html += '</option>';
				}else{
					html += '<option value="';
					html += value;
					html += '">';
					html += value;
					html += '</option>';
				}
			}
		}
		html += '    </select>';
		if(this.config.help){
			html += '<div class="collapse" id="'+inputFieldId+'_help">';
			html += '  <div class="card card-body form-help">'+this.config.help+'</div>';
			html += '</div>';
		}
		html += '  </div>';
		if(size<10){
			html += '  <div class="col-'+(10-size)+'">&nbsp;</div>';
		}
		html += '</div>';
		parent.append(html);
		let field = this;
		$('#'+inputFieldId).on('change',function(){
			field.fireFormEvent({"type": "change","source": field.config.name});
		});
		if(typeof this.config.datasource!='undefined'){
			this.fetchDataFromDatasource(function(data){
				var itemList = data;
				let labelRenderer = null;
				let valueRenderer = null;
				if(field.config.renderer && field.config.renderer.label){
					labelRenderer = new window[field.config.renderer.label.type](field.config.renderer.label);
				}else{
					labelRenderer = new ItemRenderer({});
				}
				if(field.config.renderer && field.config.renderer.value){
					valueRenderer = new window[field.config.renderer.value.type](field.config.renderer.value);
				}else{
					valueRenderer = new ItemRenderer({});
				}
				for(var i=0;i<itemList.length;i++){
					let record = itemList[i];
					let html = '';
					let label = labelRenderer.render(record);
					let value = valueRenderer.render(record);
					html += '<option title="'+label+'">';
					html += value;
					html += '</option>';
					$('#'+inputFieldId).append(html);
				}
			});
		}
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		let inputFieldId = this.baseId+'_'+this.config.name;
		if(editing){
			$('#'+inputFieldId).prop('disabled',false);
		}else{
			$('#'+inputFieldId).prop('disabled',true);
		}
	}
	setFocus(){
		let inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId).focus();
	}
	setData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		if(typeof parentObj[this.config.name]!='undefined'){
			$('#'+inputFieldId).val(parentObj[this.config.name]);
		}else{
			$('#'+inputFieldId+'  :nth-child(0)').prop('selected', true);
		}
	}
	assignData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		parentObj[this.config.name] = $('#'+inputFieldId).val();
	}
	vetoRaised(){
		return false;
	}
}

const CODE_MIRROR_DEPTS = [
	{"type": "css","uri": "/css/codemirror.css"},
	{"type": "css","uri": "/css/codeMirror/abcdef.css"},
	{"type": "css","uri": "/uiTools/css/editor.css"},
	{"type": "js","uri": "/js/codemirror.js"},
	{"type": "js","uri": "/js/codeMirror/autorefresh.js"},
	{"type": "js","uri": "/js/codeMirror/javascript.js"},
	{"type": "js","uri": "/js/codeMirror/loadmode.js"},
	{"type": "js","uri": "/js/codeMirror/meta.js"}
];
const DEFAULT_EDITOR_HEIGHT = 300;

class SourceEditorField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		var html = '';
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-10">';
		if(typeof this.config.buttons!='undefined'){
			html += '<div id="'+inputFieldId+'_buttonBar" class="d-grid gap-2 d-md-flex">';//justify-content-md-end
			for(var i=0;i<this.config.buttons.length;i++){
				var button = this.config.buttons[i];
				html += '<button type="button" class="btn btn-sm btn-icon" data-actionid="'+button.actionId+'" disabled><img class="form-icon" src="'+button.icon+'" title="'+this.getLocalizedString(button.label)+'"></button>';
			}
			html += '</div>';
		}
		html += '    <textarea id="'+inputFieldId+'" class="form-control" style="border: 1px solid lightgrey; background-color: #fff;"></textarea>';
		html += '  </div>';
		html += '</div>';
		parent.append(html);
		this.reloadEventsHandler();
		let editorMode = 'json';
		if(typeof this.config.type!='undefined' && this.config.type=='javascript'){
			editorMode = 'javascript';
		}
		var source = this;
		loadDeps(CODE_MIRROR_DEPTS,function(){
			var textArea = document.getElementById(inputFieldId);
			source.form.editors[source.config.name] = CodeMirror.fromTextArea(textArea, {
			    lineNumbers: true,
    			autoRefresh:true,
			    theme: "abcdef",
			    mode:  editorMode,
			    readOnly: true
			});
			setTimeout(function(){ source.form.editors[source.config.name].setOption("mode",editorMode); },100);
			
			if(typeof source.config.height!='undefined'){
				source.form.editors[source.config.name].setSize(null,source.config.height);
			}else{
				source.form.editors[source.config.name].setSize(null,DEFAULT_EDITOR_HEIGHT);
			}
		});
	}
	reloadEventsHandler(){
		let inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId+'_buttonBar button').off('.'+inputFieldId);
		$('#'+inputFieldId+'_buttonBar button').on('click.'+inputFieldId,function(){
			var actionId = $(this).data('actionid');
			npaUi.fireEvent(actionId,{"action": actionId,"field": $('#'+inputFieldId)});
		});
	}
	addButton(buttonStruct){
		let inputFieldId = this.baseId+'_'+this.config.name;
		let html = '<button type="button" class="btn btn-sm btn-icon" data-actionid="'+buttonStruct.actionId+'" disabled><img class="form-icon" src="'+buttonStruct.icon+'" title="'+this.getLocalizedString(buttonStruct.label)+'"></button>';
		$('#'+inputFieldId+'_buttonBar').append(html);
		this.reloadEventsHandler();
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		if(typeof this.form.editors[this.config.name]=='undefined'){
			let editor = this;
			setTimeout(function(){ editor.setEnabled(editing);},500);
		}else{
			let inputFieldId = this.baseId+'_'+this.config.name;
			if(editing){
				this.form.editors[this.config.name].setOption('readOnly',false);
				if(typeof this.config.buttons!='undefined'){
					$('#'+inputFieldId+'_buttonBar button').prop('disabled',false);
				}
			}else{
				this.form.editors[this.config.name].setOption('readOnly',true);
				if(typeof this.config.buttons!='undefined'){
					$('#'+inputFieldId+'_buttonBar button').prop('disabled',true);
				}
			}
		}
	}
	setFocus(){
		let inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId).focus();
	}
	setData(parentObj){
		if(typeof this.form.editors[this.config.name]=='undefined'){
			let editor = this;
			setTimeout(function(){ editor.setData(parentObj);},500);
		}else{
			if(typeof parentObj[this.config.name]!='undefined'){
				this.form.editors[this.config.name].setValue(parentObj[this.config.name]);
			}else{
				if(this.config.type=='json'){
					this.form.editors[this.config.name].setValue('{\n}');
				}
				if(this.config.type=='javascript'){
					this.form.editors[this.config.name].setValue('//some javascript code snippet here\n');
				}
			}
		}
	}
	assignData(parentObj){
		//var inputFieldId = this.baseId+'_'+this.config.name;
		parentObj[this.config.name] = this.form.editors[this.config.name].getValue();
	}
	vetoRaised(){
		if(this.config.type=='json'){
			var jsonTxt = this.form.editors[this.config.name].getValue();
			try{
				var jsonObj = JSON.parse(jsonTxt);
				return false;
			}catch(parseException){
				showError(this.getLocalizedString('@form.editor.json.error',[this.config.name]));
				return true;
			}
		}else{
			return false;
		}
	}
}

class TextAreaField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		let html = '';
		let size = 8;
		if(typeof this.config.size!='undefined'){
			size = this.config.size;
		}
		let style = '';
		if(typeof this.config.style!='undefined'){
			style = this.config.style;
		}
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-'+size+'">';
		html += '    <textarea id="'+inputFieldId+'" class="form-control" style="'+style+'" rows="'+this.config.rows+'" disabled="true"></textarea>';
		html += '  </div>';
		if(size<10){
			html += '  <div class="col-'+(10-size)+'">&nbsp;</div>';
		}
		html += '</div>';
		parent.append(html);
		let field = this;
		$('#'+inputFieldId).on('input',function(){
			field.fireFormEvent({"type": "change","source": field.config.name});
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		let inputFieldId = this.baseId+'_'+this.config.name;
		if(editing){
			$('#'+inputFieldId).prop('disabled',false);
		}else{
			$('#'+inputFieldId).prop('disabled',true);
		}
	}
	setFocus(){
		let inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId).focus();
	}
	setData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId).val(parentObj[this.config.name]);
		$('#'+inputFieldId).removeClass('is-invalid');
	}
	assignData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		parentObj[this.config.name] = $('#'+inputFieldId).val();
	}
	vetoRaised(){
		var inputFieldId = this.baseId+'_'+this.config.name;
		var fieldValue = $('#'+inputFieldId).val();
		if(this.config.required && (typeof fieldValue=='undefined' || fieldValue.length==0)){
			$('#'+inputFieldId).addClass('is-invalid');
			$('#'+inputFieldId).focus();
			showError(this.getLocalizedString('@form.textField.error',[this.config.name]));
			return true;
		}else{
			$('#'+inputFieldId).removeClass('is-invalid');
			return false;
		}
	}
}

class ArrayEditorField extends LabeledFormField{
	datatype = 'text';
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		let html = '';
		let rows = 7;
		if(typeof this.config.rows!='undefined'){
			rows = this.config.rows;
		}
		if(typeof this.config.datatype!='undefined'){
			this.datatype = this.config.datatype;
		}
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-9">';
		html += '    <div class="row form-row">';
		if(typeof this.config.editable=='undefined' || this.config.editable){
			html += '      <div class="col-9">';
			html += '        <input id="'+inputFieldId+'_edit" type="text" class="form-control" readonly>';
			html += '      </div>';
			html += '      <div class="col-1">';
			html += '        <button id="'+inputFieldId+'_gobtn" type="button" class="btn btn-primary" disabled>'+this.getLocalizedString('@form.arrayEditor.button.go')+'</button>';
			html += '      </div>';
			html += '    </div>';
		}
		html += '    <div class="row">';
		html += '      <div class="col-9">';
		html += '        <select id="'+inputFieldId+'_list" class="form-select" size="'+rows+'" disabled>';
		html += '        </select>';
		html += '      </div>';
		if(typeof this.config.editable=='undefined' || this.config.editable){
			html += '      <div class="col-1">';
			html += '        <button type="button" id="'+inputFieldId+'_addbtn" class="btn btn-sm form-btn-icon" disabled><img src="/uiTools/img/silk/add.png" class="form-icon" title="'+this.getLocalizedString('@form.arrayEditor.button.add',[this.datatype])+'"></button>';
			html += '        <button type="button" id="'+inputFieldId+'_editbtn" class="btn btn-sm form-btn-icon" disabled><img src="/uiTools/img/silk/pencil.png" class="form-icon" title="'+this.getLocalizedString('@form.arrayEditor.button.edit',[this.datatype])+'"></button>';
			html += '        <button type="button" id="'+inputFieldId+'_delbtn" class="btn btn-sm form-btn-icon" disabled><img src="/uiTools/img/silk/cross.png" class="form-icon" title="'+this.getLocalizedString('@form.arrayEditor.button.delete',[this.datatype])+'"></button>';
			html += '        <button type="button" id="'+inputFieldId+'_upbtn" class="btn btn-sm form-btn-icon" disabled><img src="/uiTools/img/silk/arrow_up.png" class="form-icon" title="'+this.getLocalizedString('@form.arrayEditor.button.up',[this.datatype])+'"></button>';
			html += '        <button type="button" id="'+inputFieldId+'_downbtn" class="btn btn-sm form-btn-icon" disabled><img src="/uiTools/img/silk/arrow_down.png" class="form-icon" title="'+this.getLocalizedString('@form.arrayEditor.button.down',[this.datatype])+'"></button>';
			html += '      </div>';
		}else{
			html += '      <div class="col-1">&nbsp;</div>';
		}
		html += '    </div>';
		html += '  </div>';
		html += '  <div class="col-1">&nbsp;</div>';
		html += '</div>';
		parent.append(html);
		let arrayField = this;
		$('#'+inputFieldId+'_addbtn').on('click',function(){
			$('#'+inputFieldId+'_edit').removeAttr('readonly');
			$('#'+inputFieldId+'_gobtn').prop('disabled',false);
			$('#'+inputFieldId+'_edit').focus();
			$('#'+inputFieldId+'_list option:selected').prop('selected', false);
		});
		$('#'+inputFieldId+'_gobtn').on('click',function(){
			var value = $('#'+inputFieldId+'_edit').val();
			var selectedValue = $('#'+inputFieldId+'_list option:selected').val();
			if(selectedValue){
				//update
				if(arrayField.datatype=='object'){
					$('#'+inputFieldId+'_list option:selected').val(value.replace(/'/g,'"'));
				}else{
					$('#'+inputFieldId+'_list option:selected').val(value);
				}
				$('#'+inputFieldId+'_list option:selected').text(value);
			}else{
				//create
				let option = null;
				if(arrayField.datatype=='object'){
					option = '<option value="'+value.replace(/"/g,'\'')+'">'+value+'</option>';
				}else{
					option = '<option value="'+value+'">'+value+'</option>';
				}
				//var option = '<option value="'+value+'">'+value+'</option>';
				$('#'+inputFieldId+'_list').append(option);
			}
			$('#'+inputFieldId+'_editbtn').prop('disabled',false);
			$('#'+inputFieldId+'_delbtn').prop('disabled',false);
			$('#'+inputFieldId+'_upbtn').prop('disabled',false);
			$('#'+inputFieldId+'_downbtn').prop('disabled',false);
			$('#'+inputFieldId+'_list option[value=\''+value+'\']').prop('selected', true);
			$('#'+inputFieldId+'_edit').val('');
			$('#'+inputFieldId+'_edit').attr('readonly');
			$('#'+inputFieldId+'_gobtn').prop('disabled',true);
		});
		$('#'+inputFieldId+'_delbtn').on('click',function(){
			var selectedValue = $('#'+inputFieldId+'_list option:selected').val();
			var selectedOption =   $('#'+inputFieldId+'_list option[value=\''+selectedValue+'\']');
			selectedOption.remove();
			$('#'+inputFieldId+'_edit').val('');
			$('#'+inputFieldId+'_edit').attr('readonly');
			$('#'+inputFieldId+'_gobtn').prop('disabled',true);
			$('#'+inputFieldId+'_editbtn').prop('disabled',true);
			$('#'+inputFieldId+'_delbtn').prop('disabled',true);
			$('#'+inputFieldId+'_upbtn').prop('disabled',true);
			$('#'+inputFieldId+'_downbtn').prop('disabled',true);
		});
		$('#'+inputFieldId+'_editbtn').on('click',function(){
			var selectedValue = $('#'+inputFieldId+'_list option:selected').val();
			if(arrayField.datatype=='object'){
				$('#'+inputFieldId+'_edit').val(selectedValue.replace(/'/g,'"'));
			}else{
				$('#'+inputFieldId+'_edit').val(selectedValue);
			}
			$('#'+inputFieldId+'_edit').removeAttr('readonly');
			$('#'+inputFieldId+'_gobtn').prop('disabled',false);
			$('#'+inputFieldId+'_editbtn').prop('disabled',true);
			$('#'+inputFieldId+'_delbtn').prop('disabled',false);
			$('#'+inputFieldId+'_upbtn').prop('disabled',false);
			$('#'+inputFieldId+'_downbtn').prop('disabled',false);
			$('#'+inputFieldId+'_edit').focus();
		});
		$('#'+inputFieldId+'_list').on('change',function(){
			$('#'+inputFieldId+'_editbtn').prop('disabled',false);
			$('#'+inputFieldId+'_delbtn').prop('disabled',false);
			$('#'+inputFieldId+'_upbtn').prop('disabled',false);
			$('#'+inputFieldId+'_downbtn').prop('disabled',false);
		});
		$('#'+inputFieldId+'_upbtn').on('click',function(){
			var selectedIndex = $('#'+inputFieldId+'_list').prop('selectedIndex');
			if(selectedIndex>0){//:nth-child(0)
				var current = $('#'+inputFieldId+'_list :nth-child('+(selectedIndex+1)+')');
				var prev = $('#'+inputFieldId+'_list :nth-child('+(selectedIndex)+')');
				var tmp = current.val();
				var txt = current.text();
				current.val(prev.val());
				current.text(prev.text());
				prev.val(tmp);
				prev.text(txt);
				prev.prop('selected', true);
			}
		});
		$('#'+inputFieldId+'_downbtn').on('click',function(){
			var selectedIndex = $('#'+inputFieldId+'_list').prop('selectedIndex');
			var maxIndex = $('#'+inputFieldId+'_list option').length-1;
			if(selectedIndex<maxIndex){
				var current = $('#'+inputFieldId+'_list :nth-child('+(selectedIndex+1)+')');
				var next = $('#'+inputFieldId+'_list :nth-child('+(selectedIndex+2)+')');
				var tmp = current.val();
				var txt = current.text();
				current.val(next.val());
				current.text(next.text());
				next.val(tmp);
				next.text(txt);
				next.prop('selected', true);
			}
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		let inputFieldId = this.baseId+'_'+this.config.name;
		if(editing){
			$('#'+inputFieldId+'_list').prop('disabled',false);
			$('#'+inputFieldId+'_addbtn').prop('disabled',false);
		}else{
			$('#'+inputFieldId+'_edit').attr('readonly');
			$('#'+inputFieldId+'_gobtn').prop('disabled',true);
			$('#'+inputFieldId+'_list').prop('disabled',true);
			$('#'+inputFieldId+'_addbtn').prop('disabled',true);
			$('#'+inputFieldId+'_editbtn').prop('disabled',true);
			$('#'+inputFieldId+'_delbtn').prop('disabled',true);
		}
	}
	setFocus(){
		let inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId).focus();
	}
	setData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId+'_list').empty();
		if(Array.isArray(parentObj[this.config.name])){
			for(var j=0;j<parentObj[this.config.name].length;j++){
				var value = parentObj[this.config.name][j];
				var option = '';
				if(this.datatype=='text' || this.datatype=='integer'){
					option = '<option value="'+value+'">'+value+'</option>';
				}
				if(this.datatype=='object'){
					let serialized = JSON.stringify(value);
					option = '<option value="'+serialized.replace(/"/g,'\'')+'">'+serialized+'</option>';
				}
				$('#'+inputFieldId+'_list').append(option);
			}
		}
	}
	assignData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		var values = [];
		let arrayField = this;
		$('#'+inputFieldId+'_list option').each(function(){
		    var value = $(this).val();
			if(arrayField.datatype=='text' || arrayField.datatype=='integer'){
				values.push(value);
			}
			if(arrayField.datatype=='object'){
				let obj = JSON.parse(value.replace(/'/g,'"'));
				values.push(obj);
			}
		});
		console.log();
		parentObj[this.config.name] = values;
	}
	vetoRaised(){
		return false;
	}
}

class DatatypeField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		var html = '';
		let size = 10;
		if(typeof this.config.size!='undefined'){
			size = this.config.size;
		}
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-'+size+'" id="'+this.config.siteId+'">';
		html += '  </div>';
		if(size<10){
			html += '  <div class="col-'+(10-size)+'">&nbsp;</div>';
		}
		html += '</div>';
		parent.append(html);
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		var innerForm = npaUi.getComponent(this.config.formRef);
		if(innerForm){
			innerForm.setEditMode(editing);
		}else{
			showError('Unresolved reference to Form component '+this.config.formRef);
		}
	}
	setFocus(){
	}
	setData(parentObj){
		var innerForm = npaUi.getComponent(this.config.formRef);
		if(typeof parentObj[this.config.name]!='undefined'){
			innerForm.setSelection(parentObj[this.config.name]);
		}else{
			innerForm.setSelection({});
		}
	}
	assignData(parentObj){
		var innerForm = npaUi.getComponent(this.config.formRef);
		parentObj[this.config.name] = innerForm.getData();
	}
	vetoRaised(){
		var innerForm = npaUi.getComponent(this.config.formRef);
		return !innerForm.checkFormData();
	}
}

class UploadField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		let html = '';
		let buttonLabel = 'Upload';
		if(typeof this.config.uploadButtonLabel!='undefined'){
			buttonLabel = this.config.uploadButtonLabel;
		}
		var action = 'upload';
		if(typeof this.config.actionId!='undefined'){
			action = this.config.actionId;
		}
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-7">';
		html += '     <input class="form-control" type="file" id="'+inputFieldId+'" disabled/>';
		html += '  </div>';
		html += '  <div class="col-3">';
		html += '    <button id="'+inputFieldId+'_submit" type="button" class="btn btn-primary" disabled>'+this.getLocalizedString(buttonLabel)+'</button>';
		html += '  </div>';
		html += '</div>';
		parent.append(html);
		var source = this;
		$('#'+inputFieldId+'_submit').on('click',function(){
			npaUi.fireEvent(action,{"action": action,"field": $('#'+inputFieldId)});
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		var inputFieldId = this.baseId+'_'+this.config.name;
		if(editing){
			$('#'+inputFieldId).prop('disabled',false);
			$('#'+inputFieldId+'_submit').prop('disabled',false);
		}else{
			$('#'+inputFieldId).prop('disabled',true);
			$('#'+inputFieldId+'_submit').prop('disabled',true);
		}
	}
	setFocus(){
		var inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId).focus();
	}
	vetoRaised(){
		return false;
	}
}

class ButtonField extends FormField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		var html = '';
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += '  <div class="col-2">&nbsp;</div>';
		html += '  <div class="col-10">';
		html += '     <button type="button" id="'+inputFieldId+'" class="btn btn-'+this.config.buttonType+'" disabled>'+this.getLocalizedString(this.config.label)+'</button>';
		html += '  </div>';
		html += '</div>';
		parent.append(html);
		var source = this;
		$('#'+inputFieldId).on('click',function(){
			npaUi.fireEvent(source.config.actionId,{"action": source.config.actionId,"field": $('#'+inputFieldId)});
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		var inputFieldId = this.baseId+'_'+this.config.name;
		if(editing){
			$('#'+inputFieldId).prop('disabled',false);
		}else{
			$('#'+inputFieldId).prop('disabled',true);
		}
	}
	setFocus(){
		var inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId).focus();
	}
	vetoRaised(){
		return false;
	}
}

class PlaceholderField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		let html = '';
		let size = 10;
		if(typeof this.config.size!='undefined'){
			size = this.config.size;
		}
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-'+size+'" id="'+this.config.siteId+'">';
		html += '  </div>';
		if(this.config.size<10){
			html += '  <div class="col-'+(10-size)+'">&nbsp;</div>';
		}
		html += '</div>';
		parent.append(html);
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	vetoRaised(){
		return false;
	}
}

class MultipleReferenceEditorField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	fetchDataFromDatasource(then){
		let datasource = this.config.datasource;
		if(typeof datasource!='undefined'){
			let type = 'local';
			let method = 'GET';
			let payload = {};
			if(typeof datasource.type!='undefined'){
				type = datasource.type;
			}
			if(typeof datasource.method!='undefined'){
				method = datasource.method;
			}
			if(typeof datasource.payload!='undefined'){
				payload = datasource.payload;
			}
			if('local'==type){
				console.log('MultipleReferenceEditorField#fetchDataFromDatasource() - using local data from '+datasource.uri);
				var field = this;
				makeRESTCall(method,datasource.uri,payload,function(response){
					if(response.status==200){
						then(field.adaptFormat(response));
					}else{
						console.log(response);
					}
				},function(errorMsg){
					console.log(errorMsg);
				});
			}
			if('managed'==type){
				console.log('MultipleReferenceEditorField#fetchDataFromDatasource() - using DataManager #'+datasource.manager);
				let dataManager = npaUi.getComponent(datasource.manager);
				if(typeof dataManager!='undefined'){
					dataManager.query(payload).then(then);
				}
			}
		}
	}
	fetchSingleDataFromDatasource(id,then){
		console.log('MultipleReferenceEditorField#fetchSingleDataFromDatasource('+id+')');
		let datasource = this.config.datasource;
		if(typeof datasource!='undefined'){
			let type = 'local';
			let method = 'GET';
			let payload = {};
			if(typeof datasource.type!='undefined'){
				type = datasource.type;
			}
			if(typeof datasource.method!='undefined'){
				method = datasource.method;
			}
			if('local'==type){
				console.log('MultipleReferenceEditorField#fetchSingleDataFromDatasource() - using local data from '+datasource.uri);
				payload = {"selector": {"$eq": {"id": id}}};
				var field = this;
				makeRESTCall(method,datasource.uri,payload,function(response){
					if(response.status==200){
						let results = field.adaptFormat(response);
						if(results.length>0){
							then(results[0]);
						}else{
							then(null);
						}
					}else{
						console.log(response);
					}
				},function(errorMsg){
					console.log(errorMsg);
				});
			}
			if('managed'==type){
				console.log('MultipleReferenceEditorField#fetchSingleDataFromDatasource() - using DataManager #'+datasource.manager);
				payload = {"id": id};
				let dataManager = npaUi.getComponent(datasource.manager);
				if(typeof dataManager!='undefined'){
					dataManager.findByPrimaryKey(payload).then(then);
				}
			}
		}
	}
	adaptFormat(inputData){
		let datasource = this.config.datasource;
		let dsType = 'local';
		if(typeof datasource.type!='undefined'){
			dsType = datasource.type;
		}
		if('local'==dsType){
			if(datasource.adapter){
				var data = [];
				var toEval = 'data = '+datasource.adapter.replace(/@/g,'inputData')+';'
				try{
					eval(toEval);
					return data;
				}catch(t){
					console.log('MultipleReferenceEditorField#adaptFormat(inputData) - exception evaluating adapter for datasource');
					return [];
				}
			}else{
				return inputData;
			}
		}
		console.log('MultipleReferenceEditorField#adaptFormat(inputData) - no adapter configured for datasource type '+dsType);
		return [];
	}
	render(parent){
		let visibleRowCount = 5;
		if(typeof this.config.rows!='undefined'){
			visibleRowCount = this.config.rows;
		}
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		var html = '';
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-4">';
		html += '    '+this.getLocalizedString('@form.multiple.reference.available')+'<br>';
		html += '    <select id="'+this.baseId+'_source_'+this.config.name+'" class="form-select" size="'+visibleRowCount+'" disabled>';
		html += '    </select>';
		html += '  </div>';
		html += '  <div class="col-1">';
		html += '    <br>';
		html += '    <button type="button" id="'+inputFieldId+'_addBtn" class="btn btn-sm form-btn-icon" disabled><img src="/uiTools/img/silk/add.png" title="'+this.getLocalizedString('@form.multiple.reference.button.add',[this.config.label])+'" class="form-icon"></button><br>';
		html += '    <button type="button" id="'+inputFieldId+'_removeBtn" class="btn btn-sm form-btn-icon" disabled><img src="/uiTools/img/silk/delete.png" title="'+this.getLocalizedString('@form.multiple.reference.button.remove',[this.config.label])+'" class="form-icon"></button><br>';
		html += '  </div>';
		html += '  <div class="col-4">';
		html += '    '+this.getLocalizedString('@form.multiple.reference.associated')+'<br>';
		html += '    <select id="'+inputFieldId+'" class="form-select" size="'+visibleRowCount+'" disabled>';
		html += '    </select>';
		html += '  </div>';
		html += '  <div class="col-1">&nbsp;</div>';
		html += '</div>';
		parent.append(html);
		var field = this;
		this.fetchDataFromDatasource(function(data){
			var itemList = data;
			let titleRenderer = null;
			let valueRenderer = null;
			if(field.config.renderer && field.config.renderer.title){
				titleRenderer = new window[field.config.renderer.title.type](field.config.renderer.title);
			}else{
				titleRenderer = new ItemRenderer({});
			}
			if(field.config.renderer && field.config.renderer.value){
				valueRenderer = new window[field.config.renderer.value.type](field.config.renderer.value);
			}else{
				valueRenderer = new ItemRenderer({});
			}
			for(var i=0;i<itemList.length;i++){
				let record = itemList[i];
				let html = '';
				let title = titleRenderer.render(record);
				let value = valueRenderer.render(record);
				html += '<option value="'+record.id+'" title="'+title+'">';
				html += value;
				html += '</option>';
				$('#'+field.baseId+'_source_'+field.config.name).append(html);
			}
		});
		var field = this;
		$('#'+this.baseId+'_source_'+this.config.name).on('change',function(e){
			$('#'+inputFieldId+'_addBtn').prop('disabled',false);
		});
		$('#'+inputFieldId).on('change',function(e){
			$('#'+inputFieldId+'_removeBtn').prop('disabled',false);
		});
		$('#'+inputFieldId+'_addBtn').on('click',function(){
			var selectedId = $('#'+field.baseId+'_source_'+field.config.name+' option:selected').val();
			var selectedOption =  $('#'+field.baseId+'_source_'+field.config.name+' option[value=\''+selectedId+'\']');
			//is the selected option already right
			var itemAlreadyAssociated = false;
			$('#'+field.baseId+'_'+field.config.name+' option').each(function(){
			    var associatedOptionId = $(this).val();
			    if(associatedOptionId==selectedId){
					itemAlreadyAssociated = true;
				}
			});
			if(!itemAlreadyAssociated || typeof field.config.unique=='undefined' || !field.config.unique){
				var html = '<option value="'+selectedId+'" title="'+selectedOption.prop('title')+'">'+selectedOption.text()+'</option>';
				$('#'+inputFieldId).append(html);
			}
		});
		$('#'+inputFieldId+'_removeBtn').on('click',function(){
			var selectedId = $('#'+inputFieldId+' option:selected').val();
			var selectedOption =  $('#'+inputFieldId+' option[value=\''+selectedId+'\']');
			selectedOption.remove();
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		var inputFieldId = this.baseId+'_'+this.config.name;
		var inputSourceFieldId = this.baseId+'_source_'+this.config.name;
		if(editing){
			$('#'+inputFieldId).prop('disabled',false);
			$('#'+inputSourceFieldId).prop('disabled',false);
		}else{
			$('#'+inputFieldId).prop('disabled',true);
			$('#'+inputSourceFieldId).prop('disabled',true);
		}
	}
	setFocus(){
	}
	setData(parentObj){
		console.log('MultipleReferenceEditorField#setData()');
		console.log(parentObj);
		var inputFieldId = this.baseId+'_'+this.config.name;
		var field = this;
		$('#'+inputFieldId).empty();
		if(typeof parentObj[this.config.name]!='undefined'){
			var loadReferenceList = function(list,index,dataArray,next){
				if(index<list.length){
					var refDataId = list[index];
					console.log('processing reference: '+refDataId);
					field.fetchSingleDataFromDatasource(refDataId,function(data){
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
			loadReferenceList(parentObj[field.config.name],0,referencedData,function(){
				var html = '';
				let titleRenderer = null;
				let valueRenderer = null;
				if(field.config.renderer && field.config.renderer.title){
					titleRenderer = new window[field.config.renderer.title.type](field.config.renderer.title);
				}else{
					titleRenderer = new ItemRenderer({});
				}
				if(field.config.renderer && field.config.renderer.value){
					valueRenderer = new window[field.config.renderer.value.type](field.config.renderer.value);
				}else{
					valueRenderer = new ItemRenderer({});
				}
				for(var i=0;i<referencedData.length;i++){
					let record = referencedData[i];
					let title = titleRenderer.render(record);
					let value = valueRenderer.render(record);
					html += '<option value="'+record.id+'" title="'+title+'">';
					html += value;
					html += '</option>';
				}
				$('#'+inputFieldId).append(html);
			});
		}
	}
	assignData(parentObj){
		var inputFieldId = this.baseId+'_'+this.config.name;
		parentObj[this.config.name] = $('#'+inputFieldId).val();
		var refDataIds = [];
		$('#'+inputFieldId+' option').each(function(){
		    var associatedOptionId = $(this).val();
		    refDataIds.push(associatedOptionId);
		});
		parentObj[this.config.name] = refDataIds;
	}
	vetoRaised(){
		var inputFieldId = this.baseId+'_'+this.config.name;
		if(this.config.required){
			var refDataIds = [];
			$('#'+inputFieldId+' option').each(function(){
			    var associatedOptionId = $(this).val();
			    refDataIds.push(associatedOptionId);
			});
			if(refDataIds.length==0){
				showError(this.getLocalizedString('@form.multiple.reference.error',[this.config.name]));
				return true;
			}
		}
		return false;
	}
}

class SingleReferenceEditorField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	fetchDataFromDatasource(then){
		let datasource = this.config.datasource;
		if(typeof datasource!='undefined'){
			let type = 'local';
			let method = 'GET';
			let payload = {};
			if(typeof datasource.type!='undefined'){
				type = datasource.type;
			}
			if(typeof datasource.method!='undefined'){
				method = datasource.method;
			}
			if(typeof datasource.payload!='undefined'){
				payload = datasource.payload;
			}
			if('local'==type){
				console.log('SingleReferenceEditorField#fetchDataFromDatasource() - using local data from '+datasource.uri);
				var field = this;
				makeRESTCall(method,datasource.uri,payload,function(response){
					if(response.status==200){
						then(field.adaptFormat(response));
					}else{
						console.log(response);
					}
				},function(errorMsg){
					console.log(errorMsg);
				});
			}
			if('managed'==type){
				console.log('SingleReferenceEditorField#fetchDataFromDatasource() - using DataManager #'+datasource.manager);
				let dataManager = npaUi.getComponent(datasource.manager);
				if(typeof dataManager!='undefined'){
					dataManager.query(payload).then(then);
				}
			}
		}
	}
	fetchSingleDataFromDatasource(id,then){
		console.log('SingleReferenceEditorField#fetchSingleDataFromDatasource('+id+')');
		let datasource = this.config.datasource;
		if(typeof datasource!='undefined'){
			let type = 'local';
			let method = 'GET';
			let payload = {};
			if(typeof datasource.type!='undefined'){
				type = datasource.type;
			}
			if(typeof datasource.method!='undefined'){
				method = datasource.method;
			}
			if('local'==type){
				console.log('SingleReferenceEditorField#fetchSingleDataFromDatasource() - using local data from '+datasource.uri);
				payload = {"selector": {"$eq": {"id": id}}};
				var field = this;
				makeRESTCall(method,datasource.uri,payload,function(response){
					if(response.status==200){
						let results = field.adaptFormat(response);
						if(results.length>0){
							then(results[0]);
						}else{
							then(null);
						}
					}else{
						console.log(response);
					}
				},function(errorMsg){
					console.log(errorMsg);
				});
			}
			if('managed'==type){
				console.log('SingleReferenceEditorField#fetchSingleDataFromDatasource() - using DataManager #'+datasource.manager);
				payload = {"id": id};
				let dataManager = npaUi.getComponent(datasource.manager);
				if(typeof dataManager!='undefined'){
					dataManager.findByPrimaryKey(payload).then(then);
				}
			}
		}
	}
	adaptFormat(inputData){
		let datasource = this.config.datasource;
		let dsType = 'local';
		if(typeof datasource.type!='undefined'){
			dsType = datasource.type;
		}
		if('local'==dsType){
			if(datasource.adapter){
				var data = [];
				var toEval = 'data = '+datasource.adapter.replace(/@/g,'inputData')+';'
				try{
					eval(toEval);
					return data;
				}catch(t){
					console.log('SingleReferenceEditorField#adaptFormat(inputData) - exception evaluating adapter for datasource');
					return [];
				}
			}else{
				return inputData;
			}
		}
		console.log('SingleReferenceEditorField#adaptFormat(inputData) - no adapter configured for datasource type '+dsType);
		return [];
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		let size = 8;
		if(typeof this.config.size!='undefined' && this.config.size<=10){
			size = this.config.size;
		}
		var html = '';
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-'+size+'">';
		html += '    <select id="'+inputFieldId+'" class="form-select" disabled>';
		if(!this.config.required){
			html += '  <option value="">'+this.getLocalizedString('@form.SingleReferenceEditorField.select.value')+'</option>';
		}
		html += '    </select>';
		if(this.config.help){
			html += '<div class="collapse" id="'+inputFieldId+'_help">';
			html += '  <div class="card card-body form-help">'+this.config.help+'</div>';
			html += '</div>';
		}
		html += '  </div>';
		if(size<10){
			html += '  <div class="col-'+(10-size)+'">&nbsp;</div>';
		}
		html += '</div>';
		parent.append(html);
		let field = this;
		this.fetchDataFromDatasource(function(data){
			var itemList = data;
			let titleRenderer = null;
			let valueRenderer = null;
			if(field.config.renderer && field.config.renderer.title){
				titleRenderer = new window[field.config.renderer.title.type](field.config.renderer.title);
			}else{
				titleRenderer = new ItemRenderer({});
			}
			if(field.config.renderer && field.config.renderer.value){
				valueRenderer = new window[field.config.renderer.value.type](field.config.renderer.value);
			}else{
				valueRenderer = new ItemRenderer({});
			}
			for(var i=0;i<itemList.length;i++){
				let record = itemList[i];
				let html = '';
				let title = titleRenderer.render(record);
				let value = valueRenderer.render(record);
				html += '<option value="'+record.id+'" title="'+title+'">';
				html += value;
				html += '</option>';
				$('#'+inputFieldId).append(html);
			}
		});
		$('#'+inputFieldId).on('change',function(){
			field.fireFormEvent({"type": "change","source": field.config.name});
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		let inputFieldId = this.baseId+'_'+this.config.name;
		if(editing){
			$('#'+inputFieldId).prop('disabled',false);
		}else{
			$('#'+inputFieldId).prop('disabled',true);
		}
	}
	setFocus(){
		let inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId).focus();
	}
	setData(parentObj){
		let inputFieldId = this.baseId+'_'+this.config.name;
		$('#'+inputFieldId+'  option:first').prop('selected', true);
		if(typeof parentObj[this.config.name]!='undefined'){
			$('#'+inputFieldId).val(parentObj[this.config.name]);
		}
	}
	assignData(parentObj){
		let inputFieldId = this.baseId+'_'+this.config.name;
		parentObj[this.config.name] = $('#'+inputFieldId).val();
	}
	vetoRaised(){
		return false;
	}
}

const RICH_TEXT_EDITOR_DEPTS = [
	 {"type": "css","uri": "/css/rte/rte.css"},
     {"type": "js","uri": "/js/richText/rte.js"},
     {"type": "js","uri": "/uiTools/js/richText/rteControls.js"}
];

class RichTextEditorField extends LabeledFormField{
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		var html = '';
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		html += '  <div class="col-10">';
		if(typeof this.config.buttons!='undefined'){
			html += '<div id="'+inputFieldId+'_buttonBar" class="d-grid gap-2 d-md-flex">';//justify-content-md-end
			for(var i=0;i<this.config.buttons.length;i++){
				var button = this.config.buttons[i];
				html += '<button type="button" class="btn btn-sm btn-icon" data-actionid="'+button.actionId+'" disabled><img class="img-icon" src="'+button.icon+'" title="'+this.getLocalizedString(button.label)+'"></button>';
			}
			html += '</div>';
		}
		html += '    <div id="'+inputFieldId+'"></div>';
		html += '  </div>';
		html += '</div>';
		parent.append(html);
		var source = this;
		$('#'+inputFieldId+'_buttonBar button').on('click',function(){
			var actionId = $(this).data('actionid');
			npaUi.fireEvent(actionId,{"action": actionId,"editor": source.form.editors[source.config.name]});
		});
		loadDeps(RICH_TEXT_EDITOR_DEPTS,function(){
			var width = 800; // default width
			var height = 300; // default height
			if(typeof source.config.height!='undefined'){
				height = source.config.height;
			}
			if(typeof source.config.width!='undefined'){
				width = source.config.width;
			}
			var parentId = source.baseId+'_'+source.config.name;
			var editor = new RichTextEditor(parentId+'_rte',width,height);
			editor.controlObject = 'NpaEditorControls';
			editor.init($('#'+parentId).get(0));
			editor.disable();
			source.form.editors[source.config.name] = editor;
		});
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		console.log('RichTextEditorField#setEnabled('+editing+')');
		let inputFieldId = this.baseId+'_'+this.config.name;
		if(typeof this.form.editors[this.config.name]!='undefined'){
			if(editing){
				this.form.editors[this.config.name].enable();
				if(typeof this.config.buttons!='undefined'){
					$('#'+inputFieldId+'_buttonBar button').prop('disabled',false);
				}
			}else{
				this.form.editors[this.config.name].disable();
				if(typeof this.config.buttons!='undefined'){
					$('#'+inputFieldId+'_buttonBar button').prop('disabled',true);
				}
			}
		}else{
			let editor = this;
			setTimeout(function(){ editor.setEnabled(editing); },500);
		}
	}
	setFocus(){
		this.form.editors[this.config.name].focus();
	}
	setData(parentObj){
		if(typeof this.form.editors[this.config.name]!='undefined'){
			if(typeof parentObj[this.config.name]!='undefined'){
				this.form.editors[this.config.name].setText(parentObj[this.config.name]);
			}else{
				this.form.editors[this.config.name].setText('');
			}
		}else{
			let editor = this;
			setTimeout(function(){ editor.setData(parentObj); },500);
		}
	}
	assignData(parentObj){
		parentObj[this.config.name] = this.form.editors[this.config.name].getText();
	}
	vetoRaised(){
		return false;
	}
}

/*
 * {
		"name": "fieldName,
		"label": "fieldLabel",
		"type": "pluggable",
		"requires": [
			{"type": "js","uri": "/<path>/<requiredLibrary>.js"}
		],
		"editor": "qualified-editor-class-name",
		"siteId": "<some-DIV-#ID>"
   }
 */
class PluggableEditorField extends LabeledFormField{
	innerEditor = null;
	pendingValue = null;
	siteId = null;
	constructor(config,form){
		super(config,form);
	}
	render(parent){
		this.baseId = parent.prop('id');
		let inputFieldId = this.baseId+'_'+this.config.name;
		this.siteId = inputFieldId+'_site';
		if(this.config.siteId){
			this.siteId = this.config.siteId;
		}
		let html = '';
		html += '<div class="row form-row" id="'+inputFieldId+'_row">';
		html += this.generateLabel();
		let size = 10;
		if(this.config.size){
			size = this.config.size;
		}
		html += '  <div class="col-'+size+'" id="'+this.siteId+'">';
		html += '  </div>';
		if(size<10){
			html += '  <div class="col-'+(10-size)+'">&nbsp;</div>';
		}
		html += '</div>';
		parent.append(html);
		var comp = this;
		if(this.config.requires){
			loadDeps(this.config.requires,function(){
				comp.plugEditor();
			});
		}else{
			this.plugEditor();
		}
	}
	getPluginSite(){
		return $('#'+this.siteId);
	}
	plugEditor(){
		let dotIndex = this.config.editor.indexOf('.');
		let namespace = '';
		if(dotIndex<0){
			namespace = 'npaUiCore.';
		}
		let editor = null;
		let comp = this;
		let toEval = 'editor = new '+namespace+this.config.editor+'(comp);';
		try{
			eval(toEval);
			this.innerEditor = editor;
			this.innerEditor.render();
		}catch(t){
			console.log(t);
		}
	}
	hide(){
		super.hide();
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).hide();
	}
	show(){
		let inputFielRowId = '#'+this.baseId+'_'+this.config.name+'_row';
		$(inputFielRowId).show();
	}
	setEnabled(editing){
		if(this.innerEditor!=null){
			this.innerEditor.setEnabled(editing);
		}else{
			let field = this;
			setTimeout(function(){ field.innerEditor.setEnabled(editing); },300);
		}
	}
	setFocus(){
		this.innerEditor.setFocus();
	}
	setData(parentObj){
		if(typeof parentObj[this.config.name]!='undefined'){
			if(this.innerEditor){
			this.innerEditor.setValue(parentObj[this.config.name]);
			}else{
				this.pendingValue = parentObj[this.config.name];
			}
		}
	}
	assignData(parentObj){
		if(this.innerEditor){
			let value = this.innerEditor.getValue();
			parentObj[this.config.name] = value;
		}
	}
	vetoRaised(){
		return false;
	}
}
 
/*
 * "configuration": {
	"datatype": <datatype>
   }
 */  
apaf.DatatypeForm = class DatatypeForm extends NpaUiComponent{
	fieldCache = {};
	editors = {};
	formData = null;
	formEventListeners = [];
	specializedEditors = {};
	datatype = null;
	initialize(then){
		var form = this;
		$.loadCss('/uiTools/css/form.css',function(){
			makeRESTCall('GET','/uiToolsApis/editors',{},function(response){
				if(response.status==200 && response.data && response.data.length>0){
					for(var i=0;i<response.data.length;i++){
						let specializedEditorConfig = response.data[i];
						form.specializedEditors[specializedEditorConfig.datatype] = specializedEditorConfig;
					}
				}
				form.loadDatatype(function(datatypeRecord){
					form.datatype = datatypeRecord;
					then();
				});
			},function(msg){
				console.log('Caught exception while loading specialized editors');
				console.log(msg);
				form.loadDatatype(function(datatypeRecord){
					form.datatype = datatypeRecord;
					then();
				});
			});
		});
	}
	loadDatatype(then){
		let uri = '/apaf-datatype/datatype?name='+this.getConfiguration().datatype;
		makeRESTCall('GET',uri,{},function(response){
			if(response.status==200){
				then(response.data);
			}else{
				showError(response.message);
			}
		},function(errorMsg){
			showError(errorMsg);
		});
	}
	createFormField(config){
		if(typeof config.type=='undefined'){
			config.type = 'text';
		}
		if('text'==config.type){
			return new TextField(config,this)
		}
		if('password'==config.type || 'passwordCheck'==config.type){
			return new PasswordField(config,this)
		}
		if('url'==config.type){
			return new UrlField(config,this)
		}
		if('integer'==config.type){
			return new NumericField(config,this)
		}
		if('date'==config.type){
			return new DateField(config,this)
		}
		if('option'==config.type || 'check'==config.type|| 'switch'==config.type){
			return new CheckField(config,this)
		}
		if('radio'==config.type){
			return new RadioField(config,this)
		}
		if('color'==config.type){
			return new ColorPickerField(config,this)
		}
		if('range'==config.type){
			return new RangeSelectorField(config,this)
		}
		if('select'==config.type){
			return new SelectField(config,this)
		}
		if('json'==config.type || 'javascript'==config.type){
			return new SourceEditorField(config,this)
		}
		if('textarea'==config.type){
			return new TextAreaField(config,this)
		}
		if('array'==config.type){
			return new ArrayEditorField(config,this)
		}
		if('datatype'==config.type){
			return new DatatypeField(config,this)
		}
		if('upload'==config.type){
			return new UploadField(config,this)
		}
		if('button'==config.type){
			return new ButtonField(config,this)
		}
		if('placeholder'==config.type){
			return new PlaceholderField(config,this)
		}
		if('richText'==config.type){
			return new RichTextEditorField(config,this);
		}
		if('reference'==config.type && config.multiple){
			return new MultipleReferenceEditorField(config,this);
		}
		if('reference'==config.type && !config.multiple){
			return new SingleReferenceEditorField(config,this);
		}
		if('pluggable'==config.type){
			return new PluggableEditorField(config,this);
		}
		let specializedPluggableEditor = this.specializedEditors[config.type];
		if(typeof specializedPluggableEditor!='undefined'){
			let newConfig = Object.assign({},config);
			newConfig.requires = specializedPluggableEditor.libraries;
			newConfig.editor = specializedPluggableEditor.editor;
			return new PluggableEditorField(newConfig,this);
		}
		return new FormField(config,this);
	}
	render(){
		let config = this.getConfiguration();
		let html = '';
		html += '<form id="'+this.getId()+'_form" class="'+config.class+'">';
		html += '</form>';
		this.parentDiv().html(html);
		for(var i=0;i<this.datatype.fields.length;i++){
			var fieldConfig = this.datatype.fields[i];
			this.fieldCache[fieldConfig.name] = this.createFormField(fieldConfig);
		}
		this.renderFields();
	}
	getFieldEditor(fieldName){
		return this.fieldCache[fieldName];
	}
	renderFields(){
		let config = this.getConfiguration();
		let html = '';
		let formClass = 'form-frame';
		if(typeof config.class!='undefined'){
			formClass = config.class;
		}
		html += '<div id="'+this.getId()+'" class="'+formClass+'">'
		if(typeof config.title!='undefined'){
			html += '<div class="form-title">'+this.getLocalizedString(config.title)+'</div>';
		}
		html += '</div>';
		$('#'+this.getId()+'_form').append(html);
		var parent = $('#'+this.getId());
		let orderedFieldList = sortOn(this.datatype.fields,'displayIndex');
		for(var i=0;i<orderedFieldList.length;i++){
			var fieldId = orderedFieldList[i].name;
			console.log('looking for helper class for field #'+fieldId+' ('+orderedFieldList[i].type+')');
			var field = this.fieldCache[fieldId];
			if(typeof field!='undefined'){
				console.log('calling '+field.config.type+' rendering');
				field.render(parent);
			}else{
				console.log('helper class not found in cache');
			}
		}
	}
	setEditMode(mode){
		console.log('form#setEditMode('+mode+')');
		for(const fieldId in this.fieldCache){
			let field = this.fieldCache[fieldId];
			console.log(fieldId);
			field.setEditMode(mode);
		}
		if(this.datatype.fields.length>0){
			this.fieldCache[this.datatype.fields[0].name].setFocus();
		}
		if(mode){
			this.fireFormEvent({"type":"editionStatusChanged","source":"form"});
		}
	}
	setData(data){
		console.log('form#setData()');
		this.formData = data;
		if(this.formData==null){
			this.formData = {};
		}
		if(typeof this.formData!='undefined'){
			for(var fieldId in this.fieldCache){
				let field = this.fieldCache[fieldId];
				field.setData(this.formData);
			}
		}
	}
	getData(){
		console.log('form#getData()');
		console.log(this.fieldCache);
		var data = Object.assign({},this.formData);
		for(const fieldId in this.fieldCache){
			let field = this.fieldCache[fieldId];
			if(field.editable){
				field.assignData(data);
			}
		}
		return data;
	}
	isValid(){
		var errorFound = false;
		for(var fieldId in this.fieldCache){
			let field = this.fieldCache[fieldId];
			console.log('checking veto for field '+fieldId);
			if(field.editable && field.vetoRaised()){
				errorFound = true;
			}
			console.log('veto: '+errorFound);
		}
		return !errorFound;
	}
	onItemSelected(item){
		console.log('form#onItemSelected()');
		this.setEditMode(false);
		if(typeof item!='undefined' && item!=null){
			this.setData(item);
		}else{
			this.setData({});
		}
	}
	registerEventListener(listener){
		if(listener && listener.onFormEvent){
			this.formEventListeners.push(listener);
		}
	}
	fireFormEvent(event){
		for(var fieldId in this.fieldCache){
			let field = this.fieldCache[fieldId];
			field.onFormEvent(event);
		}
		for(var i=0;i<this.formEventListeners.length;i++){
			try{
				this.formEventListeners[i].onFormEvent(event);
			}catch(t){}
		}
	}
	getEditor(fieldName){
		return this.editors[fieldName];
	}
}