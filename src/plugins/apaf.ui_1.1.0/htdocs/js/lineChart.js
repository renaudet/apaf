/*
 * lineChart.js - APAF UI LineChart component (based on Chart.js)
 * Copyright 2026 Nicolas Renaudet - All rights reserved
 */

const LINE_CHART_CSS_URI = '/apaf-ui/css/lineChart.css';
const LINE_CHART_LIBRARY_URI = '/apaf-ui/lib/chart.umd.js';
const LINE_CHART_DEFAULT_HEIGHT = 300;
const LINE_CHART_DEFAULT_TENSION = 0.3;
const LINE_CHART_PALETTE = ['#3b82d4','#e5484d','#30a46c','#f5a623','#7c5cd8','#12a594','#d6409f','#8d8d8d'];

if(typeof apafUi=='undefined'){
	apafUi = {};
}

/*
 * The component manages the HTML canvas and the Chart.js instance by itself:
 * the developer only declares a <div> placeholder and a JSON configuration.
 *
 * "configuration": {
 *     "title": "<optional chart title - supports @i18n.key>",
 *     "height": <optional height in pixels - default 300>,
 *     "labelField": "<name of the row attribute used for the X axis>",
 *     "series": [
 *         {
 *             "field": "<name of the row attribute used for the Y values>",
 *             "label": "<optional series label - supports @i18n.key - default is the field name>",
 *             "color": "<optional CSS color>",
 *             "fill": true/false
 *         }
 *     ],
 *     "xAxisLabel": "<optional X axis title - supports @i18n.key>",
 *     "yAxisLabel": "<optional Y axis title - supports @i18n.key>",
 *     "legend": true/false (default true),
 *     "smooth": true/false (default true),
 *     "beginAtZero": true/false (default false),
 *     "datasource": {
 *         "type": "local" | "managed" | "manual",
 *         "uri": "<REST URI - local only>",
 *         "method": "<HTTP method - local only - default GET>",
 *         "payload": {<optional payload>},
 *         "adapter": "<optional expression returning the rows array - @ represents the REST response (local) >",
 *         "manager": "<DataManager component id - managed only>"
 *     },
 *     "selectionListener": true/false,
 *     "selectionProvider": "<source component ID>",
 *     "selectionAdapter": "<optional expression returning the rows array - @ represents the selected item>"
 * }
 *
 * Without datasource (or with the "manual" type) the data is provided with setData(rows).
 * Clicking a point fires a 'select' event: {"source": <component id>,"item": <the row>}
 */
apafUi.LineChart = class LineChart extends NpaUiComponent{
	chart = null;
	dataset = [];
	initialize(then){
		let deps = [];
		if($('link[href="'+LINE_CHART_CSS_URI+'"]').length==0){
			deps.push({"type": "css","uri": LINE_CHART_CSS_URI});
		}
		if(typeof Chart=='undefined'){
			deps.push({"type": "js","uri": LINE_CHART_LIBRARY_URI});
		}
		loadDeps(deps,function(){
			then();
		});
	}
	canvasId(){
		return this.getId()+'_canvas';
	}
	plainText(expr){
		// localized strings may contain HTML entities which a canvas can't interpret
		return $('<div />').html(this.getLocalizedString(expr)).text();
	}
	render(then){
		let config = this.getConfiguration();
		if($('#'+this.canvasId()).length==0){
			this.destroy();
			let height = typeof config.height!='undefined'?config.height:LINE_CHART_DEFAULT_HEIGHT;
			let html = '';
			html += '<div id="'+this.getId()+'_wrapper" class="apaf-linechart apaf-linechart-empty" style="height: '+height+'px;">';
			html += '  <canvas id="'+this.canvasId()+'"></canvas>';
			html += '  <div class="apaf-linechart-nodata">'+this.getLocalizedString('@apaf.ui.linechart.nodata')+'</div>';
			html += '</div>';
			this.parentDiv().html(html);
			this.createChart();
		}
		this.refresh();
		then();
	}
	buildDatasets(){
		let config = this.getConfiguration();
		let tension = (typeof config.smooth=='undefined' || config.smooth)?LINE_CHART_DEFAULT_TENSION:0;
		let series = config.series?config.series:[];
		let datasets = [];
		for(var i=0;i<series.length;i++){
			let serie = series[i];
			let color = serie.color?serie.color:LINE_CHART_PALETTE[i%LINE_CHART_PALETTE.length];
			let isHexColor = /^#[0-9a-fA-F]{6}$/.test(color);
			datasets.push({
				"label": this.plainText(serie.label?serie.label:serie.field),
				"data": [],
				"borderColor": color,
				"backgroundColor": (serie.fill && isHexColor)?color+'33':color,
				"fill": serie.fill?true:false,
				"tension": tension
			});
		}
		return datasets;
	}
	createChart(){
		let config = this.getConfiguration();
		let component = this;
		let axisTitle = function(expr){
			return expr?{"display": true,"text": component.plainText(expr)}:{"display": false};
		}
		this.chart = new Chart(document.getElementById(this.canvasId()),{
			"type": "line",
			"data": {"labels": [],"datasets": this.buildDatasets()},
			"options": {
				"responsive": true,
				"maintainAspectRatio": false,
				"plugins": {
					"legend": {"display": typeof config.legend=='undefined' || config.legend},
					"title": config.title?{"display": true,"text": this.plainText(config.title)}:{"display": false}
				},
				"scales": {
					"x": {"title": axisTitle(config.xAxisLabel)},
					"y": {"title": axisTitle(config.yAxisLabel),"beginAtZero": config.beginAtZero?true:false}
				},
				"onClick": function(event){
					let points = component.chart.getElementsAtEventForMode(event,'nearest',{"intersect": true},true);
					if(points.length>0){
						npaUi.fireEvent('select',{"source": component.getId(),"item": component.dataset[points[0].index]});
					}
				}
			}
		});
	}
	fetchDataFromDatasource(then){
		let datasource = this.getConfiguration().datasource;
		let type = typeof datasource.type!='undefined'?datasource.type:'local';
		let method = typeof datasource.method!='undefined'?datasource.method:'GET';
		let payload = typeof datasource.payload!='undefined'?datasource.payload:{};
		let component = this;
		if('local'==type){
			makeRESTCall(method,datasource.uri,payload,function(response){
				if(response.status==200){
					then(component.adaptFormat(response));
				}else{
					console.log(response);
				}
			},function(errorMsg){
				console.log(errorMsg);
			});
		}else
		if('managed'==type){
			let dataManager = npaUi.getComponent(datasource.manager);
			if(typeof dataManager!='undefined'){
				dataManager.query(payload).then(then);
			}
		}
	}
	evaluate(expression,input){
		let rows = [];
		let toEval = 'rows = '+expression.replace(/@/g,'input')+';';
		try{
			eval(toEval);
		}catch(t){
			console.log('LineChart#evaluate() - exception evaluating '+expression);
			console.log(t);
		}
		return rows;
	}
	adaptFormat(response){
		let datasource = this.getConfiguration().datasource;
		if(datasource.adapter){
			return this.evaluate(datasource.adapter,response);
		}
		return response.data;
	}
	refresh(){
		let config = this.getConfiguration();
		let component = this;
		if(typeof config.datasource!='undefined' && config.datasource.type!='manual'){
			this.fetchDataFromDatasource(function(rows){
				component.setData(rows);
			});
		}else{
			this.setData(this.dataset);
		}
	}
	setData(rows){
		if(!Array.isArray(rows)){
			rows = [];
		}
		this.dataset = rows;
		if(this.chart!=null){
			let config = this.getConfiguration();
			let series = config.series?config.series:[];
			this.chart.data.labels = rows.map(function(row){
				return row[config.labelField];
			});
			for(var i=0;i<series.length;i++){
				let field = series[i].field;
				this.chart.data.datasets[i].data = rows.map(function(row){
					return row[field];
				});
			}
			this.chart.update();
			$('#'+this.getId()+'_wrapper').toggleClass('apaf-linechart-empty',rows.length==0);
		}
	}
	onItemSelected(item){
		let config = this.getConfiguration();
		if(typeof item=='undefined' || item==null){
			this.setData([]);
		}else
		if(config.selectionAdapter){
			this.setData(this.evaluate(config.selectionAdapter,item));
		}else{
			this.setData(item);
		}
	}
	destroy(){
		if(this.chart!=null){
			this.chart.destroy();
			this.chart = null;
		}
	}
}
