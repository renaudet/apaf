/*
 * apafDatatable.js - APAF specialized Datatable component'
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */
 
apaf.Datatable = class Datatable extends NpaUiComponent{
	itemSorter = null;
	dataset = [];
	editable = true;
	initialize(then){
		$.loadCss('/uiTools/css/datatable.css',then);
		if(this.getConfiguration().sorter){
			this.itemSorter = new window[this.getConfiguration().sorter.type](this.getConfiguration().sorter);
		}else{
			this.itemSorter = new ItemSorter({});
		}
	}
	fetchDataFromDatasource(then){
		let datasource = this.getConfiguration().datasource;
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
			console.log('Datatable#fetchDataFromDatasource() - using local data from '+datasource.uri);
			var datatable = this;
			makeRESTCall(method,datasource.uri,payload,function(response){
				if(response.status==200){
					then(datatable.adaptFormat(response));
				}else{
					console.log(response);
				}
			},function(errorMsg){
				console.log(errorMsg);
			});
		}
		if('managed'==type){
			console.log('Datatable#fetchDataFromDatasource() - using DataManager #'+datasource.manager);
			let dataManager = npaUi.getComponent(datasource.manager);
			if(typeof dataManager!='undefined'){
				dataManager.query(payload).then(then);
			}
		}
	}
	adaptFormat(inputData){
		let datasource = this.getConfiguration().datasource;
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
					console.log('datatable.js#adaptFormat(inputData) - exception evaluating adapter for datasource');
					return [];
				}
			}else{
				console.log('Datatable#adaptFormat()');
				console.log(inputData);
				return inputData;
			}
		}
		console.log('datatable.js#adaptFormat(inputData) - no adapter configured for datasource type '+dsType);
		return [];
	}
	render(){
		let config = this.getConfiguration();
		if($('#'+this.getId()+'_table').length==0){
			let html = '';
			html += '<div id="'+this.getId()+'" style="max-height: '+config.maxHeight+'px;overflow: auto;">';
			html += '<table id="'+this.getId()+'_table" class="table table-striped table-hover table-sm">';
			html += '  <thead class="table-dark">';
			html += '    <tr>';
			for(var i=0;i<config.columns.length;i++){
				let column = config.columns[i];
				let widthExpr = '';
				if(typeof column.width!='undefined'){
					widthExpr = 'width: '+column.width+'px;'
				}
				if(typeof column.label!='undefined'){
					html += '<th scope="col" style="position: sticky; top: 0;z-index: 1;'+widthExpr+'">';
					html += this.getLocalizedString(column.label);
					html += '</th>';
				}else{
					html += '<th scope="col" style="position: sticky; top: 0;z-index: 1;'+widthExpr+'">';
					html += typeof column.field!='undefined'?column.field:'';
					html += '</th>';
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
		this.refresh();
	}
	refresh(){
		console.log('Datatable#refresh()');
		var datatable = this;
		let config = this.getConfiguration();
		if(typeof config.datasource!='undefined'){
			this.fetchDataFromDatasource(function(data){
				console.log('received '+data.length+' rows from datasource');
				console.log(data);
				datatable.renderData(data)
			});
		}else{
			this.renderData(this.dataset);
		}
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
		console.log('rendering index: '+index);
		console.log(column);
		let html = '';
		html += '<td';
		if(column.width){
			html += ' width="';
			html += column.width;
			html += '"';
		}
		html += '>';
		if(typeof column.altRenderer!='undefined' && column.altRenderer.length>0){
			let toEval = 'html += '+column.altRenderer.replace(/@/g,'item').replace(/{/g,'\'+').replace(/}/g,'+\'')+';';
			try{
				eval(toEval);
			}catch(evalException){
				console.log(toEval);
				console.log(evalException);
				html += '???';
			}
		}else
		if(typeof column.renderer!='undefined' && column.renderer.length>0 && 'relationship'!=column.type){
			let toEval = 'html += '+column.renderer.replace(/@/g,'item').replace(/{/g,'\'+').replace(/}/g,'+\'')+';';
			try{
				eval(toEval);
			}catch(evalException){
				console.log(toEval);
				console.log(evalException);
				html += '???';
			}
		}else
		if(typeof column.type!='undefined'){
			if('rowActions'==column.type){
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
				if('text'==column.type || 'select'==column.type || 'date'==column.type || 'ruleDataReference'==column.type){
					let value = item[column.field];
					if(typeof value=='undefined'){
						html += 'n/a';
					}else{
						html += value;
					}
				}else
				if('textarea'==column.type){
					let value = item[column.field];
					if(value && value.length>15){
						value = value.substring(0,14)+'<i>[...]</i>';
					}
					html += value;
				}else
				if('boolean'==column.type || 'check'==column.type || 'switch'==column.type){
					let booleanValue = item[column.field];
					if(booleanValue){
						html += '<img src="/uiTools/img/silk/accept.png">';
					}else{
						html += '<img src="/uiTools/img/silk/cross.png">';
					}
				}else
				if('integer'==column.type || 'number'==column.type || 'numeric'==column.type){
					let numberValue = item[column.field];
					let leftMarge = 15;
					if(typeof column.leftMarge!='undefined'){
						leftMarge = column.leftMarge;
					}
					html += '<div style="text-align: right;padding-right: '+leftMarge+'px;">'+numberValue+'</div>';
				}else
				if('progress'==column.type){
					let progressValue = item[column.field];
					html += '<div class="progress" role="progressbar" style="margin-top: 3px;height: 20px;">';
					var progressColor = '';
					if(column.processor){
						let toEval = 'progressColor = \' \' + ('+column.processor.replace(/@/g,'item').replace(/{/g,'\'+').replace(/}/g,'+\'')+');';
						try{
							eval(toEval);
						}catch(evalException){
							console.log(toEval);
							console.log(evalException);
						}
					}
					html += '    <div class="progress-bar progress-bar-striped'+progressColor+'" style="width: '+progressValue+'%">'+progressValue+'%</div>';
					html += '    <div class="progress-bar bg-white" style="width: '+(100-progressValue)+'%"></div>';
					html += '</div>';
				}else
				if('color'==column.type){
					let colorValue = item[column.field];
					html += '<span class="column-type-color" style="background-color: '+colorValue+';"><span class="column-type-color-tooltip">&nbsp;'+colorValue+'&nbsp;</span>&nbsp;</span>';
				}else
				if('reference'==column.type){
					let datatypeId = item[column.field];
					html += '<span id="'+datatypeId+'">pending...</span>';
					if(column.datasource && 'managed'==column.datasource.type){
						let dataManager = npaUi.getComponent(column.datasource.manager);
						dataManager.findByPrimaryKey({"id": datatypeId}).then(function(data){
							if(column.processor){
								let spanInnerHtml = '';
								let toEval = 'spanInnerHtml += '+column.processor.replace(/@/g,'data').replace(/{/g,'\'+').replace(/}/g,'+\'')+';';
								try{
									eval(toEval);
								}catch(evalException){
									console.log(toEval);
									console.log(evalException);
									spanInnerHtml += '???';
								}
								$('#'+datatypeId).html(spanInnerHtml);
							}else{
								$('#'+datatypeId).html(datatypeId);
							}
						}).onError(function(){
							$('#'+datatypeId).html(datatypeId);
						});
					}
				}else
				if('relationship'==column.type){
					if(column.multiple){
						html += '[<i>'+column.datatype+'</i>]';
					}else{
						html += '<i>'+column.datatype+'</i>';
					}
				}else{
					html += '?';
				}
			}
		}else
		if(typeof column.field!='undefined'){
			let value = item[column.field];
			html += value;
		}else{
			html += '?';
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
				console.log('datatable#onItemSelected() evaluating content adapter: '+toEval);
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
		//this.getId()+'_table
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