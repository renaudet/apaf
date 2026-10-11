/*
 * manageTraces.js - APAF Debug Trace Level manager client-side script
 * Copyright 2026 Nicolas Renaudet - All rights reserved
 */

const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const CARD_ID = 'manageTracesCard';

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.onComponentLoaded = function(){
				npaUi.onComponentLoaded = function(){};
				initLogsBrowser();
			};
			npaUi.render();
		});
	});
};

setStatus = function(status){
	var card = $apaf(CARD_ID);
	if(card){ card.setStatus(status); }
};

/* ─── Tree model ─────────────────────────────────────────────────── */

var logsVisitor = {
	getLabel: function(element){
		if('root'==element.type){ return element.name; }
		if('plugin'==element.type){ return element.pluginId; }
	},
	getChildren: function(element){
		if('root'==element.type){ return element.plugins; }
		return [];
	},
	isParent: function(element){
		return 'root'==element.type;
	}
};

var logsDecorator = {
	decorate: function(element,label){
		if('root'==element.type){
			return '<img src="/uiTools/img/silk/server_connect.png">&nbsp;<b>'+label+'</b>';
		}
		if('plugin'==element.type){
			return '<img src="/uiTools/img/silk/transmit_blue.png">&nbsp;'+label;
		}
		return label;
	}
};

var selectedPlugin = null;
var currentLogOffset = 0;
var currentLogLimit = 100;

var logsEventListener = {
	onNodeSelected: function(node){
		setStatus('');
		if('plugin'==node.data.type){
			var pluginObj = node.data;
			selectedPlugin = pluginObj;
			currentLogOffset = 0;
			getPluginLogLevel(node.data.pluginId,function(level){
				pluginObj.logLevel = level;
				setStatus(apaf.localize('@apaf.debug.traces.status.selected')+' '+pluginObj.pluginId+' \u2014 '+apaf.localize('@apaf.debug.traces.status.level')+' '+level);
				refreshLogLevelControlArea(pluginObj);
				var tty = $apaf('console');
				tty.clear();
				getLogFileContent('out',function(lines){
					displayLogFileContent(lines);
				});
			});
		}
	}
};

/* ─── Log display ────────────────────────────────────────────────── */

displayLogFileContent = function(lines){
	var tty = $apaf('console');
	tty.clear();
	if(lines.length==0){
		tty.println('(no content)');
	}else{
		for(var i=0;i<lines.length;i++){
			tty.println(lines[i]);
		}
	}
	updatePaginationControls();
};

updatePaginationControls = function(){
	$('#logPrevBtn').prop('disabled', currentLogOffset===0);
};

/* ─── Log level form helpers ─────────────────────────────────────── */

var formLevelFromLogLevel = {
	"error":  0,
	"info":   1,
	"fine":   2,
	"finest": 3
};

var logLevelFromFormLevel = {
	0: "error",
	1: "info",
	2: "fine",
	3: "finest"
};

refreshLogLevelControlArea = function(pluginObj){
	var form = $apaf('logLevelForm');
	if(!form){ return; }
	var levelAsInt = formLevelFromLogLevel[pluginObj.logLevel];
	form.setData({"level": levelAsInt,"logType": "out"});
	form.setEditMode(true);
};

refreshLogContent = function(){
	var form = $apaf('logLevelForm');
	var logType = form.getData().logType;
	currentLogOffset = 0;
	getLogFileContent(logType,function(lines){
		displayLogFileContent(lines);
	});
};

logPageNext = function(){
	var form = $apaf('logLevelForm');
	var logType = form.getData().logType;
	currentLogOffset += currentLogLimit;
	getLogFileContent(logType,function(lines){
		displayLogFileContent(lines);
	});
};

logPagePrev = function(){
	var form = $apaf('logLevelForm');
	var logType = form.getData().logType;
	currentLogOffset = Math.max(0, currentLogOffset-currentLogLimit);
	getLogFileContent(logType,function(lines){
		displayLogFileContent(lines);
	});
};

onLogFormValuesChanged = function(event){
	var form = $apaf('logLevelForm');
	var newLevel = form.getData().level;
	var newLogLevel = logLevelFromFormLevel[newLevel];
	if(selectedPlugin && selectedPlugin.logLevel!=newLogLevel){
		apaf.call({
			"method": "PUT",
			"uri": '/apaf-logs/plugin/'+selectedPlugin.pluginId,
			"payload": {"level": newLogLevel}
		}).then(function(data){
			selectedPlugin.logLevel = newLogLevel;
			flash(apaf.localize('@apaf.debug.traces.flash.updated')+' '+selectedPlugin.pluginId+' \u2192 '+newLogLevel);
			setStatus(apaf.localize('@apaf.debug.traces.status.selected')+' '+selectedPlugin.pluginId+' \u2014 '+apaf.localize('@apaf.debug.traces.status.level')+' '+newLogLevel);
		}).onError(function(errorMsg){
			showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	}
	if(event.source=='logType'){
		var logType = form.getData().logType;
		currentLogOffset = 0;
		getLogFileContent(logType,function(lines){
			displayLogFileContent(lines);
		});
	}
};

/* ─── Log browser initialisation ────────────────────────────────── */

var logsBrowser = null;

initLogsBrowser = function(){
	var height = $('#workArea').height()-10;
	$('#logsTreeArea').height(height);
	$('#logsTreeArea').css('max-height',height);
	$('#logsTreeArea').css('overflow','auto');
	$(window).on('resize',function(){
		var h = $('#workArea').height()-10;
		$('#logsTreeArea').height(h);
		$('#logsTreeArea').css('max-height',h);
	});

	$('#logsTreeArea').empty();
	logsBrowser = new TreeViewer('logsBrowserTree',$('#logsTreeArea')[0]);
	logsBrowser.init();
	logsBrowser.setVisitor(logsVisitor);
	logsBrowser.setDecorator(logsDecorator);
	logsBrowser.setEventListener(logsEventListener);

	apaf.call({
		"method": "GET",
		"uri": "/apaf-logs/",
		"payload": {}
	}).then(function(data){
		var model = createLogModel(data);
		logsBrowser.addRootData(model);
		logsBrowser.refreshTree();
	}).onError(function(errorMsg){
		showError(errorMsg.message?errorMsg.message:errorMsg);
	});

	var consoleHeight = $('#workArea').height()-300;
	var LOG_LEVEL_FORM_CONFIG = {
		"id": "logLevelForm",
		"version": "1.0.0",
		"type": "Form",
		"configuration": {
			"title": apaf.localize('@apaf.debug.traces.form.title'),
			"class": "form-frame-noborder",
			"selectionListener": false,
			"fields": [
				{
					"name": "level",
					"label": apaf.localize('@apaf.debug.traces.form.level'),
					"type": "range",
					"default": 0,
					"size": 9,
					"min": 0,
					"max": 3,
					"step": 1,
					"renderer": "@==\"0\"?\"error\":(@==\"1\"?\"info\":(@==\"2\"?\"fine\":(@==\"3\"?\"finest\":\"n/a\")))"
				},
				{
					"name": "logType",
					"label": apaf.localize('@apaf.debug.traces.form.logfile'),
					"type": "radio",
					"default": "out",
					"choices": [
						{"label": apaf.localize('@apaf.debug.traces.form.logfile.std'), "value": "out"},
						{"label": apaf.localize('@apaf.debug.traces.form.logfile.err'), "value": "err"}
					]
				},
				{
					"name": "refresh",
					"label": apaf.localize('@apaf.debug.traces.form.refresh'),
					"type": "button",
					"buttonType": "secondary",
					"actionId": "refreshLog"
				}
			]
		}
	};
	var CONSOLE_CONFIG = {
		"id": "console",
		"version": "1.0.0",
		"type": "Console",
		"configuration": {
			"height": consoleHeight,
			"style": "margin-top: 15px;background-color: #eeeeee;color: #000000;"
		}
	};

	var html = '';
	html += '<div id="logLevelControlArea" class="apaf-logs" data-ref="logLevelForm"></div>';
	html += '<div style="margin-top:8px;">';
	html += '<button id="logNextBtn" type="button" class="btn btn-sm btn-outline-secondary" style="margin-right:6px;" onclick="logPageNext()">&laquo; '+apaf.localize('@apaf.debug.traces.btn.older')+'</button>';
	html += '<button id="logPrevBtn" type="button" class="btn btn-sm btn-outline-secondary" onclick="logPagePrev()" disabled>'+apaf.localize('@apaf.debug.traces.btn.newer')+' &raquo;</button>';
	html += '</div>';
	html += '<div id="consoleArea" class="apaf-logs" data-ref="console"></div>';
	$('#logLevelArea').html(html);

	npaUi.registerComponentConfig('logLevelForm',LOG_LEVEL_FORM_CONFIG);
	npaUi.registerComponentConfig('console',CONSOLE_CONFIG);
	npaUi.on('refreshLog',refreshLogContent);
	$(window).on('resize',function(){
		var tty = $apaf('console');
		if(tty){ tty.setHeight($('#workArea').height()-300); }
	});
	npaUi.onComponentLoaded = function(){
		var tty = $apaf('console');
		if(tty){ tty.setHeight($('#workArea').height()-300); }
		var form = $apaf('logLevelForm');
		if(form){
			form.registerEventListener({"onFormEvent": function(event){ onLogFormValuesChanged(event); }});
		}
	};
	npaUi.render('apaf-logs');
};

/* ─── Helpers ────────────────────────────────────────────────────── */

getPluginLogLevel = function(pluginId,then){
	apaf.call({
		"method": "GET",
		"uri": '/apaf-logs/plugin/'+pluginId,
		"payload": {}
	}).then(function(level){
		then(level);
	}).onError(function(errorMsg){
		showError(errorMsg.message?errorMsg.message:errorMsg);
	});
};

getLogFileContent = function(logType,then){
	var uri = '/apaf-logs/'+logType+'/'+selectedPlugin.pluginId+'?offset='+currentLogOffset+'&limit='+currentLogLimit;
	apaf.call({
		"method": "GET",
		"uri": uri,
		"payload": {}
	}).then(function(lines){
		then(lines);
	}).onError(function(errorMsg){
		showError(errorMsg.message?errorMsg.message:errorMsg);
	});
};

createLogModel = function(list){
	var apafRoot = {"name": apaf.localize('@apaf.debug.traces.tree.root'),"type": "root","plugins": []};
	var items = [];
	for(var i=0;i<list.length;i++){
		items.push({"type": "plugin","pluginId": list[i]});
	}
	items = sortOn(items,'pluginId');
	for(var i=0;i<items.length;i++){
		apafRoot.plugins.push(items[i]);
	}
	return apafRoot;
};
