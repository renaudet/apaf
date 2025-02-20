/*
 * apafDatatable2.js - APAF specialized Datatable component'
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */
 
const FIELD_DATE_FORMAT = 'YYYY/MM/DD';
const FIELD_DATE_DISPLAY_FORMAT_KEY = '@apaf.date.display.format';
 
class FieldRenderer {
	constructor(){
	}
	render(item,field){
		return '<i>not implemented</i>';
	}
}

class TextFieldRenderer extends FieldRenderer{
	render(item,field){
		if(item[field.name]){
			return item[field.name];
		}else{
			return '';
		}
	}
}

class NumericFieldRenderer extends FieldRenderer{
	render(item,field){
		if(item[field.name]){
			return '<div class="column-type-numeric">'+item[field.name]+'</div>';
		}else{
			return '';
		}
	}
}

class PasswordFieldRenderer extends FieldRenderer{
	render(item,field){
		return '********';
	}
}

class UrlFieldRenderer extends FieldRenderer{
	render(item,field){
		if(item[field.name]){
			return '<a href="'+item[field.name]+'" target="_other">'+(item[field.name].length>30?item[field.name].substring(0,30)+'[...]':item[field.name])+'</a>';
		}else{
			return '';
		}
	}
}

class DateFieldRenderer extends FieldRenderer{
	displayFormat = FIELD_DATE_FORMAT;
	constructor(){
		super();
		this.displayFormat = npaUi.getLocalizedString(FIELD_DATE_DISPLAY_FORMAT_KEY);
	}
	render(item,field){
		if(item[field.name]){
			let date = moment(item[field.name],FIELD_DATE_FORMAT);
			return date.format(this.displayFormat);
		}else{
			return '??/??/????';
		}
	}
}

class SwitchFieldRenderer extends FieldRenderer{
	render(item,field){
		if(typeof item[field.name]!='undefined' && item[field.name]){
			return '<img src="/uiTools/img/silk/accept.png"/>';
		}else{
			return '<img src="/uiTools/img/silk/cross.png"/>';
		}
	}
}

class RadioFieldRenderer extends FieldRenderer{
	render(item,field){
		if(item[field.name]){
			return item[field.name];
		}else{
			return '';
		}
	}
}

class ColorFieldRenderer extends FieldRenderer{
	render(item,field){
		if(item[field.name]){
			return '<span style="background-color: '+item[field.name]+';padding-left: 8px;padding-right: 8px;border-radius: 0.3rem;">&nbsp;</span>';
		}else{
			return 'n/a';
		}
	}
}

class RangeFieldRenderer extends FieldRenderer{
	render(item,field){
		if(item[field.name]){
			return '<div class="column-type-numeric">'+item[field.name]+'</div>';
		}else{
			return '';
		}
	}
}

class SelectFieldRenderer extends FieldRenderer{
	render(item,field){
		if(item[field.name]){
			return item[field.name];
		}else{
			return '';
		}
	}
}

class SourceFieldRenderer extends FieldRenderer{
	render(item,field){
		if(item[field.name]){
			return '<div class="column-type-numeric">'+(Math.round((item[field.name].length/1024)*100)).toFixed(1)+'ko</div>';
		}else{
			return '<i>empty</i>';
		}
	}
}

class TextAreaFieldRenderer extends FieldRenderer{
	render(item,field){
		if(item[field.name]){
			return '<div class="column-type-numeric">'+(Math.round((item[field.name].length/1024)*100)).toFixed(1)+'ko</div>';
		}else{
			return '<i>empty</i>';
		}
	}
}

class ArrayFieldRenderer extends FieldRenderer{
	render(item,field){
		if(item[field.name]){
			if(item[field.name].length==0){
				return '[]';
			}else
			if(item[field.name].length==1){
				return '["'+item[field.name][0]+'"]';
			}else
				return '[..,..]';
		}else{
			return '<i>empty</i>';
		}
	}
}

class RichTextFieldRenderer extends FieldRenderer{
	render(item,field){
		if(item[field.name]){
			return '<div class="column-type-numeric">'+(Math.round((item[field.name].length/1024)*100)).toFixed(1)+'ko</div>';
		}else{
			return '<i>empty</i>';
		}
	}
}

class RuleDataReferenceFieldRenderer extends FieldRenderer{
	render(item,field){
		if(item[field.name]){
			return item[field.name];
		}else{
			return '';
		}
	}
}

var relationshipFieldRendererInvocationCount = 0;
class RelationshipFieldRenderer extends FieldRenderer{
	render(item,field){
		if(item[field.name]){
			if(field.multiple){
				return '[..,..]';
			}else{
				let refId = 'relation_'+(relationshipFieldRendererInvocationCount++);
				setTimeout(function(){
					apaf.loadDatatypeInstance(item[field.name],field.datatype)
					    .then(function(record){
							if(field.renderer && field.renderer.length>0){
								let htmlFragment = '';
								let toEval = 'htmlFragment = '+field.renderer.replace(/@/g,'record');
								try{
									eval(toEval);
								}catch(t){
									 htmlFragment = '####';
									 console.log('in RelationshipFieldRenderer#render() - evaluation exception');
									 console.log('toEval = '+toEval);
									 console.log('exception:');
									 console.log(t);
								}
								$('#'+refId).html(htmlFragment);
							}else{
								$('#'+refId).html('#'+record.id);
							}
					    })
					    .onError(function(){
							$('#'+refId).html('####');
					    });
				},3000);
				return '<span id="'+refId+'">[<i><a title="#'+item[field.name]+'">'+field.datatype+'</a></i>]</span>';
			}
		}else{
			return '';
		}
	}
}

const DATATABLE_DEPTS = [
	{"type": "css","uri": "/resources/css/components/apafDatatable2.css"},
	{"type": "js","uri": "/js/moment.min.js"}
]

/*
 * "configuration": {
	"maxHeight": maxHeight,
	"datatype": <datatype>,
	"filter": {"selector": {"field-name": {"$eq": "value"}}},
	"columns": [
		{"type": "field","name": "fieldName"},
		{"type": "field","name": "fieldName","style": "css-style"},
		{"type": "field","name": "fieldName","renderer": "<i>@.fieldName</i>"},
		{"type": "computed","label": "some-label","renderer": "<a href="@.fieldName">link to resource</a>"},
		{
			"type": "action",
			"label": "some-label",
			"actions": [
				{"label": "action-label","actionId": "some-id","icon": "icon-url","enabler": "@.fieldName==<value>"}
			]
		}
	]
   }
 */ 
apaf.DatatableV2 = class DatatableV2 extends NpaUiComponent{
	itemSorter = null;
	dataset = [];
	editable = true;
	datatype = null;
	fieldMap = {};
	renderers = {};
	loadRenderers(){
		this.renderers['text'] = new TextFieldRenderer();
		this.renderers['integer'] = new NumericFieldRenderer();
		this.renderers['number'] = new NumericFieldRenderer();
		this.renderers['password'] = new PasswordFieldRenderer();
		this.renderers['url'] = new UrlFieldRenderer();
		this.renderers['date'] = new DateFieldRenderer();
		this.renderers['option'] = new SwitchFieldRenderer();
		this.renderers['check'] = new SwitchFieldRenderer();
		this.renderers['switch'] = new SwitchFieldRenderer();
		this.renderers['radio'] = new RadioFieldRenderer();
		this.renderers['color'] = new ColorFieldRenderer();
		this.renderers['range'] = new RangeFieldRenderer();
		this.renderers['select'] = new SelectFieldRenderer();
		this.renderers['json'] = new SourceFieldRenderer();
		this.renderers['javascript'] = new SourceFieldRenderer();
		this.renderers['textarea'] = new TextAreaFieldRenderer();
		this.renderers['array'] = new ArrayFieldRenderer();
		this.renderers['richText'] = new RichTextFieldRenderer();
		this.renderers['ruleDataReference'] = new RuleDataReferenceFieldRenderer();
		this.renderers['relationship'] = new RelationshipFieldRenderer();
		//this.renderers[''] = new PasswordFieldRenderer();
		
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
	initialize(then){
		this.loadRenderers();
		let editor = this;
		loadDeps(DATATABLE_DEPTS,function(){
		//$.loadCss('/resources/css/components/apafDatatable2.css',function(){
			if(editor.getConfiguration().sorter){
				editor.itemSorter = new window[editor.getConfiguration().sorter.type](editor.getConfiguration().sorter);
			}else{
				editor.itemSorter = new ItemSorter({});
			}
			editor.loadDatatype(function(datatypeRecord){
				editor.datatype = datatypeRecord;
				for(var i=0;i<editor.datatype.fields.length;i++){
					let field = editor.datatype.fields[i];
					editor.fieldMap[field.name] = field;
				}
				then();
			});
		});
	}
	render(then){
		let config = this.getConfiguration();
		if($('#'+this.getId()+'_table').length==0){
			let html = '';
			html += '<div id="'+this.getId()+'" style="max-height: '+config.maxHeight+'px;overflow: auto;">';
			html += '<table id="'+this.getId()+'_table" class="table table-striped table-hover table-sm">';
			html += '  <thead class="table-dark">';
			html += '    <tr>';
			for(var i=0;i<config.columns.length;i++){
				let column = config.columns[i];
				let style = '';
				if(column.style){
					style = column.style;
				}
				if(typeof column.label!='undefined'){
					html += '<th scope="col" style="position: sticky; top: 0;z-index: 1;'+style+'">';
					html += this.getLocalizedString(column.label);
					html += '</th>';
				}else{
					let field = this.fieldMap[column.name];
					if(field){
						html += '<th scope="col" style="position: sticky; top: 0;z-index: 1;'+style+'">';
						html += field.label;
						html += '</th>';
					}else{
						html += '<th scope="col" style="position: sticky; top: 0;z-index: 1;'+style+'">';
						html += column.nam;
						html += '</th>';
					}
				}
			}
			html += '    </tr>';
			html += '  </thead>';
			html += '  <tbody class="table-group-divider">';
			html += '  </tbody>';
			html += '</table>';
			html += '</div>';
			this.parentDiv().html(html);
		}
		this.refresh(then);
	}
	refresh(then){
		var datatable = this;
		this.loadData(function(dataSet){
			datatable.renderData(dataSet);
			if(then){
				then();
			}
		});
	}
	loadData(then){
		let uri = '/user-data/'+this.getConfiguration().datatype+'/query';
		let filterExpr = {};
		let config = this.getConfiguration();
		if(config.filter){
			filterExpr = config.filter;
		}
		filterExpr.fields = ['id'];
		for(var i=0;i<config.columns.length;i++){
			let column = config.columns[i];
			if('field'==column.type){
				filterExpr.fields.push(column.name);
			}
		}
		makeRESTCall('POST',uri,filterExpr,function(response){
			if(response.status==200){
				then(response.data);
			}else{
				showError(response.message);
			}
		},function(errorMsg){
			showError(errorMsg);
		});
	}
	renderData(data){
		$('#'+this.getId()+'_table tbody').empty();
		let config = this.getConfiguration();
		let datatable = this;
		let sortedData = this.itemSorter.sort(data);
		$('.'+this.getId()+'_row').off('.'+this.getId());
		$('.datatableAction').off('.'+this.getId());
		sortedData.map(function(item,index){
			let row = '';
			row += '<tr data-index="'+index+'" class="'+datatable.getId()+'_row">';
			row += '';
			for(var i=0;i<config.columns.length;i++){
				let column = config.columns[i];
				row += datatable.renderColumn(item,index,column);
			}
			row += '</tr>';
			$('#'+datatable.getId()+'_table tbody').append(row);
		});
		$('.'+this.getId()+'_row').on('click.'+this.getId(),function(){
			let rowIndex = $(this).data('index');
			npaUi.fireEvent('select',{"source": datatable.getId(),"item": sortedData[rowIndex]});
		});
		if(this.editable){
			$('.datatableAction').on('click.'+this.getId(),function(event){
				event.stopPropagation();
				let rowIndex = $(this).data('index');
				let actionId = $(this).data('action');
				npaUi.fireEvent('select',{"source": datatable.getId(),"item": sortedData[rowIndex]});
				npaUi.fireEvent(actionId,{"source": datatable.getId(),"actionId": actionId,"item": sortedData[rowIndex]});
			});
		}
		this.dataset = data;
	}
	enableActions(){
		let sortedData = this.itemSorter.sort(this.dataset);
		let datatable = this;
		$('.datatableAction').on('click.'+this.getId(),function(event){
			event.stopPropagation();
			let rowIndex = $(this).data('index');
			let actionId = $(this).data('action');
			npaUi.fireEvent('select',{"source": datatable.getId(),"item": sortedData[rowIndex]});
			npaUi.fireEvent(actionId,{"source": datatable.getId(),"actionId": actionId,"item": sortedData[rowIndex]});
		});
	}
	renderColumn(item,index,column){
		console.log('renderColumn() index: '+index);
		console.log('column:');
		console.log(column);
		console.log('item:');
		console.log(item);
		let html = '';
		html += '<td';
		if(column.style){
			html += ' style="';
			html += column.style;
			html += '"';
		}
		html += '>';
		if('field'==column.type){
			let field = this.fieldMap[column.name];
			if(field){
				console.log('field:');
				console.log(field);
				let type = 'text';
				if(field.type){
					type = field.type;
				}
				console.log('type: '+type);
				let renderer = this.renderers[type];
				if(renderer){
					html += renderer.render(item,field);
				}else{
					html += '<small><i>????</i></small>';
				}
			}else{
				html += '<small><i>???</i></small>';
			}
		}else
		if('computed'==column.type){
			if(column.renderer && column.renderer.length>0){
				let htmlFragment = '';
				let toEval = 'htmlFragment = '+column.renderer.replace(/@/g,'item').replace(/{/g,'\'+').replace(/}/g,'+\'')+';';
				try{
					eval(toEval);
				}catch(evalException){
					console.log('Evaluating computed column:');
					console.log('toEval: '+toEval);
					console.log('Exception:');
					console.log(evalException);
					htmlFragment = '<i>####</i>';
				}
				html += htmlFragment;
			}else{
				html += '<small><i>no rule</i></small>';
			}
		}else
		if('action'==column.type){
			for(var j=0;j<column.actions.length;j++){
				let actionDef = column.actions[j];
				if(j>0){
					html += '&nbsp;';
				}
				let imgClass = 'datatableAction';
				if(actionDef.enabler){
					let enable = false;
					let toEval = 'enable = '+actionDef.enabler.replace(/@/g,'item').replace(/{/g,'\'+').replace(/}/g,'+\'')+';';
					try{
						eval(toEval);
					}catch(evalException){
						console.log(toEval);
						console.log(evalException);
					}
					if(!enable){
						imgClass = '';
					}
				}
				html += '<img src="'+actionDef.icon+'" class="'+imgClass+'" title="'+this.getLocalizedString(actionDef.label)+'" data-index="'+index+'" data-action="'+actionDef.actionId+'">';
			}
		}else{
			html += '<small><i>???</i></small>';
		}
		html += '</td>';
		return html;
	}
	onItemSelected(item){
		let config = this.getConfiguration();
		if(typeof config.contentAdapter!="undefined"){
			let data = [];
			let toEval = 'data = '+config.contentAdapter.replace(/@/g,'item')+';';
			try{
				console.log('datatable2#onItemSelected() evaluating content adapter: '+toEval);
				eval(toEval);
			}catch(t){
				console.log('evaluation exception:');
				console.log(t);
			}
			this.renderData(data);
		}
	}
	setEditable(editable){
		this.editable = editable;
		if(editable){
			this.enableActions();
		}else{
			$('.datatableAction').unbind();
		}
	}
	applyFilter(filterExpr){
		var normalizedFilterStr = filterExpr?filterExpr.toUpperCase():'';
		$('#'+this.getId()+'_table tbody tr').each(function (index, value) {
			var content = $(this).html();
			if(content.toUpperCase().indexOf(normalizedFilterStr)>=0){
				$(this).show();
			}else{
				$(this).hide();
			}
		});
	}
}