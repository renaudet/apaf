/*
 * charts.js - APAF UI statistical chart components (based on Chart.js)
 *             BarChart, PieChart, DoughnutChart, RadarChart, PolarAreaChart, ScatterChart
 * Copyright 2026 Nicolas Renaudet - All rights reserved
 */

/*
 * All the components of this file share the same base class (ChartBase) and are served by the same
 * script: the file is wrapped in a function and guarded so that it can be safely evaluated several
 * times (the UI runtime loads the script once per declared component type).
 *
 * The developer only declares a <div> placeholder and a JSON configuration. The component manages
 * the HTML canvas and the Chart.js instance by itself.
 *
 * Common configuration:
 * "configuration": {
 *     "title": "<optional chart title - supports @i18n.key>",
 *     "height": <optional height in pixels - default 300>,
 *     "legend": true/false (default true),
 *     "legendPosition": "top" | "bottom" | "left" | "right" (default top),
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
 * Type specific configuration:
 *  - BarChart, RadarChart : "labelField", "series": [{"field","label","color"}], + BarChart: "horizontal", "stacked",
 *                           "xAxisLabel", "yAxisLabel", "beginAtZero" (default true) / RadarChart: "beginAtZero" (default true)
 *  - PieChart, DoughnutChart, PolarAreaChart : "labelField", "valueField", "valueLabel", "colors": [...], "showPercentage"
 *                           + DoughnutChart: "cutout" (default "50%")
 *  - ScatterChart : "series": [{"xField","yField","label","color","radius"}], "xAxisLabel", "yAxisLabel", "beginAtZero" (default false)
 *
 * Without datasource (or with the "manual" type) the data is provided with setData(rows).
 * Clicking an element fires a 'select' event: {"source": <component id>,"item": <the row>}
 */
(function(){
	if(typeof window.apafUi=='undefined'){
		window.apafUi = {};
	}
	if(typeof apafUi.ChartBase!='undefined'){
		return;
	}

	const CHARTS_CSS_URI = '/apaf-ui/css/charts.css';
	const CHARTS_LIBRARY_URI = '/apaf-ui/lib/chart.umd.js';
	const CHARTS_DEFAULT_HEIGHT = 300;
	const CHARTS_PALETTE = ['#3b82d4','#e5484d','#30a46c','#f5a623','#7c5cd8','#12a594','#d6409f','#8d8d8d'];

	class ChartBase extends NpaUiComponent{
		chart = null;
		dataset = [];
		initialize(then){
			let deps = [];
			if($('link[href="'+CHARTS_CSS_URI+'"]').length==0){
				deps.push({"type": "css","uri": CHARTS_CSS_URI});
			}
			if(typeof Chart=='undefined'){
				deps.push({"type": "js","uri": CHARTS_LIBRARY_URI});
			}
			loadDeps(deps,function(){
				then();
			});
		}
		// ── hooks overridden by the concrete chart types ───────────────────────
		chartType(){
			return 'bar';
		}
		seriesDatasetOptions(serie,color){
			return {};
		}
		extraOptions(){
			return {};
		}
		tooltipOptions(){
			return {};
		}
		// ───────────────────────────────────────────────────────────────────────
		canvasId(){
			return this.getId()+'_canvas';
		}
		plainText(expr){
			// localized strings may contain HTML entities which a canvas can't interpret
			return $('<div />').html(this.getLocalizedString(expr)).text();
		}
		withAlpha(color,alpha='33'){
			return /^#[0-9a-fA-F]{6}$/.test(color)?color+alpha:color;
		}
		axisTitle(expr){
			return expr?{"display": true,"text": this.plainText(expr)}:{"display": false};
		}
		render(then){
			let config = this.getConfiguration();
			if($('#'+this.canvasId()).length==0){
				this.destroy();
				let height = typeof config.height!='undefined'?config.height:CHARTS_DEFAULT_HEIGHT;
				let html = '';
				html += '<div id="'+this.getId()+'_wrapper" class="apaf-chart apaf-chart-empty" style="height: '+height+'px;">';
				html += '  <canvas id="'+this.canvasId()+'"></canvas>';
				html += '  <div class="apaf-chart-nodata">'+this.getLocalizedString('@apaf.ui.chart.nodata')+'</div>';
				html += '</div>';
				this.parentDiv().html(html);
				this.createChart();
			}
			this.refresh();
			then();
		}
		buildDatasets(){
			let config = this.getConfiguration();
			let series = config.series?config.series:[];
			let datasets = [];
			for(var i=0;i<series.length;i++){
				let serie = series[i];
				let color = serie.color?serie.color:CHARTS_PALETTE[i%CHARTS_PALETTE.length];
				let dataset = {
					"label": this.plainText(serie.label?serie.label:(serie.field?serie.field:serie.yField)),
					"data": [],
					"borderColor": color,
					"backgroundColor": color
				};
				datasets.push(Object.assign(dataset,this.seriesDatasetOptions(serie,color)));
			}
			return datasets;
		}
		buildOptions(){
			let config = this.getConfiguration();
			let component = this;
			let options = {
				"responsive": true,
				"maintainAspectRatio": false,
				"plugins": {
					"legend": {
						"display": typeof config.legend=='undefined' || config.legend,
						"position": config.legendPosition?config.legendPosition:'top'
					},
					"title": config.title?{"display": true,"text": this.plainText(config.title)}:{"display": false},
					"tooltip": this.tooltipOptions()
				},
				"onClick": function(event){
					let points = component.chart.getElementsAtEventForMode(event,'nearest',{"intersect": true},true);
					if(points.length>0){
						npaUi.fireEvent('select',{"source": component.getId(),"item": component.dataset[points[0].index]});
					}
				}
			};
			return Object.assign(options,this.extraOptions());
		}
		createChart(){
			this.chart = new Chart(document.getElementById(this.canvasId()),{
				"type": this.chartType(),
				"data": {"labels": [],"datasets": this.buildDatasets()},
				"options": this.buildOptions()
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
				console.log('ChartBase#evaluate() - exception evaluating '+expression);
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
		// default implementation: one value per series and per row (Bar, Radar)
		fillData(rows){
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
		}
		setData(rows){
			if(!Array.isArray(rows)){
				rows = [];
			}
			this.dataset = rows;
			if(this.chart!=null){
				this.fillData(rows);
				this.chart.update();
				$('#'+this.getId()+'_wrapper').toggleClass('apaf-chart-empty',rows.length==0);
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
	apafUi.ChartBase = ChartBase;

	/*
	 * BarChart: vertical (default) or horizontal bars, grouped (default) or stacked.
	 */
	apafUi.BarChart = class BarChart extends ChartBase{
		chartType(){
			return 'bar';
		}
		extraOptions(){
			let config = this.getConfiguration();
			let stacked = config.stacked?true:false;
			let horizontal = config.horizontal?true:false;
			let x = {"title": this.axisTitle(config.xAxisLabel),"stacked": stacked};
			let y = {"title": this.axisTitle(config.yAxisLabel),"stacked": stacked};
			(horizontal?x:y).beginAtZero = config.beginAtZero!==false;
			return {"indexAxis": horizontal?'y':'x',"scales": {"x": x,"y": y}};
		}
	}

	/*
	 * RadarChart: "star" / spider chart, one polygon per series.
	 */
	apafUi.RadarChart = class RadarChart extends ChartBase{
		chartType(){
			return 'radar';
		}
		seriesDatasetOptions(serie,color){
			return {
				"fill": serie.fill!==false,
				"backgroundColor": this.withAlpha(color),
				"pointBackgroundColor": color
			};
		}
		extraOptions(){
			return {"scales": {"r": {"beginAtZero": this.getConfiguration().beginAtZero!==false}}};
		}
	}

	/*
	 * ScatterChart: points positioned with a numeric X and Y value (correlation between two measures).
	 */
	apafUi.ScatterChart = class ScatterChart extends ChartBase{
		chartType(){
			return 'scatter';
		}
		seriesDatasetOptions(serie,color){
			return {
				"backgroundColor": this.withAlpha(color,'99'),
				"pointRadius": typeof serie.radius!='undefined'?serie.radius:5,
				"pointHoverRadius": (typeof serie.radius!='undefined'?serie.radius:5)+2
			};
		}
		extraOptions(){
			let config = this.getConfiguration();
			let beginAtZero = config.beginAtZero?true:false;
			return {
				"scales": {
					"x": {"type": "linear","title": this.axisTitle(config.xAxisLabel),"beginAtZero": beginAtZero},
					"y": {"type": "linear","title": this.axisTitle(config.yAxisLabel),"beginAtZero": beginAtZero}
				}
			};
		}
		fillData(rows){
			let config = this.getConfiguration();
			let series = config.series?config.series:[];
			for(var i=0;i<series.length;i++){
				let serie = series[i];
				this.chart.data.datasets[i].data = rows.map(function(row){
					return {"x": row[serie.xField],"y": row[serie.yField]};
				});
			}
		}
	}

	/*
	 * Base class of the charts representing the share of each row in a whole: one value per row.
	 */
	class ProportionChartBase extends ChartBase{
		buildDatasets(){
			let config = this.getConfiguration();
			return [{
				"label": this.plainText(config.valueLabel?config.valueLabel:config.valueField),
				"data": [],
				"backgroundColor": [],
				"borderColor": "#ffffff",
				"borderWidth": 1
			}];
		}
		fillData(rows){
			let config = this.getConfiguration();
			let colors = config.colors?config.colors:CHARTS_PALETTE;
			let dataset = this.chart.data.datasets[0];
			this.chart.data.labels = rows.map(function(row){
				return row[config.labelField];
			});
			dataset.data = rows.map(function(row){
				return row[config.valueField];
			});
			dataset.backgroundColor = rows.map(function(row,index){
				return colors[index%colors.length];
			});
		}
		tooltipOptions(){
			if(!this.getConfiguration().showPercentage){
				return {};
			}
			return {
				"callbacks": {
					"label": function(context){
						let total = context.dataset.data.reduce(function(sum,value){
							return sum+(Number(value)||0);
						},0);
						let percent = total>0?(Number(context.raw)*100/total).toFixed(1):'0.0';
						return context.label+': '+context.formattedValue+' ('+percent+'%)';
					}
				}
			};
		}
	}

	/*
	 * PieChart: the "camembert".
	 */
	apafUi.PieChart = class PieChart extends ProportionChartBase{
		chartType(){
			return 'pie';
		}
	}

	/*
	 * DoughnutChart: a pie chart with a hole in the middle.
	 */
	apafUi.DoughnutChart = class DoughnutChart extends ProportionChartBase{
		chartType(){
			return 'doughnut';
		}
		extraOptions(){
			let cutout = this.getConfiguration().cutout;
			return {"cutout": typeof cutout!='undefined'?cutout:'50%'};
		}
	}

	/*
	 * PolarAreaChart: slices of equal angle whose radius depends on the value.
	 */
	apafUi.PolarAreaChart = class PolarAreaChart extends ProportionChartBase{
		chartType(){
			return 'polarArea';
		}
		extraOptions(){
			return {"scales": {"r": {"beginAtZero": true}}};
		}
	}
})();
