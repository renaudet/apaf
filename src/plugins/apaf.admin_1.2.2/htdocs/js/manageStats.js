/*
 * manageStats.js - main javascript resource for the APAF Server Stats Page
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const SESSION_TABLE_ID = 'sessionTable';
const AUTO_REFRESH_TIMEOUT = 15;
const GRAPH_HEIGHT = 450;

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.on('inspect',inspectSessionRecord);
			npaUi.on('refreshSessions',refreshSessions);
			npaUi.on('menu.item.selected',onSectionChanged);
			npaUi.onComponentLoaded = onNpaComponentLoaded;
			npaUi.render();
		});
	});
}

onNpaComponentLoaded = function(){
	refreshSessions();
	$('#graphicArea').height($('#workArea').height()-10);
	$(window).on('resize',function(){
		$('#graphicArea').height($('#workArea').height()-10);
	});
	setTimeout(refreshAll,AUTO_REFRESH_TIMEOUT*1000);
}

onSectionChanged = function(menuEvent){
	if('sessions'==menuEvent.menu){
		refreshSessions();
	}
	if('graphs'==menuEvent.menu){
		createOrUpdateGraphSection();
	}
}

refreshAll = function(){
	refreshSessions();
	createOrUpdateGraphSection();
	setTimeout(refreshAll,AUTO_REFRESH_TIMEOUT*1000);
}

loadSessionData = function(){
	let sessionTable = $apaf(SESSION_TABLE_ID);
	apaf.call({"method": "GET","uri": "/apaf-admin/stats"})
	.then(function(sessionStats){
		sessionTable.setData(sessionStats.sessions);
	})
	.onError(function(errorMsg){
		showError(errorMsg);
	});
}

refreshSessions = function(){
	let sessionTable = $apaf(SESSION_TABLE_ID);
	sessionTable.setData([]);
	loadSessionData();
}

let dialogCount = 0;
inspectSessionRecord = function(selectionEvent){
	let sessionRecord = selectionEvent.item;
	console.log(sessionRecord);
	let dialog = apaf.createModalDialog({"title": "@apaf.page.stats.sessions.dialog.title","size": "XXL"});
	let html = '';
	let dialogId = 'dialog_'+dialogCount++;
	html += '<div id="'+dialogId+'" style="font-family: courier;font-size: 0.85rem;background-color: #000000;color: #00ff00;padding: 5px;border-radius: 3px;height: 400px;max-height: 800px;overflow: auto;">&nbsp;</div>';
	dialog.setBody(html);
	$('#'+dialogId).html(JSON.stringify(sessionRecord,null,'\t').replace(/\n/g,'<br>').replace(/\t/g,'&nbsp;&nbsp;&nbsp;'));
	dialog.open();
}

let graphSectionInitialized = false;
let counters = [];

// counter names contain dots (ex: create.user.datatype.count) which are not usable in a jQuery #id selector
counterKey = function(counter){
	return counter.name.replace(/\./g,'_');
}

createOrUpdateGraphSection = function(){
	if(!graphSectionInitialized){
		loadCounters(function(counterList){
			let html = '';
			counters = counterList;
			graphSectionInitialized = true;
			for(var i=0;i<counters.length;i++){
				let counter = counters[i];
				html += '<div class="accordion-item">';
				html += '<h2 class="accordion-header accordion-header-sm">';
				html += '<button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#counter'+i+'" aria-expanded="true" aria-controls="counter'+i+'">';
				html += counter.displayLabel;
				html += '</button>';
				html += '</h2>';
				let showValue = i==0?'show':'';
				html += '<div id="counter'+i+'" class="accordion-collapse collapse '+showValue+'" data-bs-parent="#graphicsAccordion">';
				html += '  <div class="accordion-body">';
				html += '    <button id="'+counterKey(counter)+'_refreshBtn" data-counter="'+counter.name+'" class="btn btn-sm" type="button"><img src="/uiTools/img/silk/arrow_refresh.png" title="Refresh"></button>';
				html += '    <div id="'+counterKey(counter)+'_chartDiv"></div>';
				html += '  </div>';
				html += '</div>';
				html += '</div>';
			}
			$('#graphicsAccordion').html(html);
			for(var i=0;i<counters.length;i++){
				$('#'+counterKey(counters[i])+'_refreshBtn').on('click',function(){
					let counterName = $(this).data('counter');
					loadGraphicsData(counterName);
				});
			}
			// the LineChart components are rendered one after the other, then the data is loaded
			createGraphics(0,loadGraphicsData);
		});
	}else{
		loadGraphicsData();
	}
}

createGraphics = function(index,then){
	if(index<counters.length){
		createGraphic(counters[index],function(){
			createGraphics(index+1,then);
		});
	}else{
		then();
	}
}

createGraphic = function(counter,then){
	let chartId = counterKey(counter)+'_chart';
	npaUi.renderSingleComponent(chartId+'Div',{
		"id": chartId,
		"type": "apafUi.LineChart",
		"version": "1.0.0",
		"configuration": {
			"title": counter.description,
			"height": GRAPH_HEIGHT,
			"labelField": "timestamp",
			"series": [{"field": "count","label": counter.displayLabel,"fill": true}],
			"yAxisLabel": counter.unit,
			"legend": false
		}
	},then);
}

updateChart = function(counter,dataPoints){
	let chart = npaUi.getComponent(counterKey(counter)+'_chart');
	if(typeof chart!='undefined'){
		chart.setData(dataPoints);
	}
}

loadGraphicsData = function(counterName){
	let loadAndUpdate = function(counter){
		loadCounterData(counter,function(dataPoints){
			updateChart(counter,dataPoints);
		});
	}
	if(typeof counterName!='undefined'){
		for(var i=0;i<counters.length;i++){
			let counter = counters[i];
			if(counter.name==counterName){
				loadAndUpdate(counter);
			}
		}
	}else{
		for(var i=0;i<counters.length;i++){
			let counter = counters[i];
			loadAndUpdate(counter);
		}
	}
}

loadCounters = function(doWithCounters){
	apaf.call({"method": "GET","uri": "/apaf-telemetry/list"})
	.then(doWithCounters)
	.onError(function(errorMsg){
		showError(errorMsg);
	});
}

loadCounterData = function(counter,doWithData){
	let uri = '/apaf-telemetry/dimension/'+counter.name;
	apaf.call({"method": "GET","uri": uri})
	.then(function(counterData){
		doWithData(counterData.data);
	})
	.onError(function(errorMsg){
		showError(errorMsg);
	});
}
