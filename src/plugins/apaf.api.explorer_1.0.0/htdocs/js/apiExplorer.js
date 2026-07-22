/*
 * apiExplorer.js - main javascript resource for the APAF API Explorer Page
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';

const METHOD_COLORS = {
	'GET':    '#61affe',
	'POST':   '#49cc90',
	'PUT':    '#fca130',
	'DELETE': '#f93e3e'
};

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.render();
			initApiBrowser();
		});
	});
}

/*--- Tree visitor / decorator / event listener ---*/

var apiVisitor = {
	getLabel(element){
		return element.name;
	},
	getChildren(element){
		if(element.type){
			if('root'==element.type)   return element.plugins;
			if('plugin'==element.type) return element.apis;
		}
		return [];
	},
	isParent(element){
		return element.type=='root' || element.type=='plugin';
	}
};

var apiDecorator = {
	decorate(element,label){
		if(element.type){
			if('root'==element.type){
				return '<img src="/uiTools/img/silk/server_connect.png">&nbsp;<b>'+label+'</b>';
			}
			if('plugin'==element.type){
				return '<img src="/uiTools/img/silk/disconnect.png">&nbsp;<b>'+label+'</b>';
			}
			if('api'==element.type){
				let color = METHOD_COLORS[element.method] || '#aaa';
				let badge = '<span class="api-method-badge" style="background-color:'+color+';">'+element.method+'</span>';
				return badge+'&nbsp;<b>'+label+'</b>&nbsp;<span class="api-uri-tree">'+element.uri+'</span>';
			}
		}
		return label;
	}
};

var apiEventListener = {
	onNodeSelected(node){
		$('#testRestCallBtn').off('.apitest');
		$('#testRestCallResult').html('');
		$('#payload').val('');
		$('#testUri').val('');

		if('api'==node.data.type){
			showApiDetail(node.data);
		}else{
			$('#apiDetailContent').hide();
			$('#apiDetailPlaceholder').show();
		}
	}
};

/*--- API detail rendering ---*/

showApiDetail = function(api){
	let color = METHOD_COLORS[api.method] || '#aaa';

	// Header: method badge + URI
	let headerHtml = '<span class="api-method-badge api-method-badge-lg" style="background-color:'+color+';">'+api.method+'</span>';
	headerHtml += '&nbsp;<span class="api-detail-uri">'+api.uri+'</span>';
	$('#apiDetailHeader').html(headerHtml);

	// Description
	$('#apiDetailDescription').text(api.description || '');

	// Security
	$('#apiSecurityLabel').html(
		'<img src="/uiTools/img/silk/lock.png">&nbsp;<b>Security role:</b>&nbsp;'
		+'<span class="api-security-badge">'+(api.securityRole||'none')+'</span>'
	);

	// Input sample for POST/PUT
	if(('POST'==api.method || 'PUT'==api.method) && api.input){
		$('#apiInputLabel').html('<b>Request body sample:</b>').show();
		let txt = (typeof api.input=='object')
			? JSON.stringify(api.input,null,'  ')
			: api.input;
		$('#apiInputContent').text(txt).show();
	}else{
		$('#apiInputLabel').hide();
		$('#apiInputContent').hide();
	}

	// Test panel setup
	$('#testUri').val(api.uri);

	if('POST'==api.method || 'PUT'==api.method){
		$('#payloadRow').show();
		if(api.input && typeof api.input=='object'){
			$('#payload').val(JSON.stringify(api.input,null,'  '));
		}else{
			$('#payload').val('{\n}');
		}
	}else{
		$('#payloadRow').hide();
		if(api.input && typeof api.input=='string' && api.input.length>0){
			$('#testUri').val(api.uri+'?'+api.input);
		}
	}

	$('#testRestCallResult').html('');

	$('#testRestCallBtn').on('click.apitest',function(){
		$('#testRestCallResult').html('<i>Calling...</i>');
		let targetUri = $('#testUri').val();
		let method = api.method;
		let payload = ('POST'==method || 'PUT'==method) ? parsePayload($('#payload').val()) : {};
		apaf.call({
			"method": method,
			"uri": targetUri,
			"payload": payload
		}).then(function(data){
			let formatted = JSON.stringify(data,null,'  ')
				.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
				.replace(/\n/g,'<br>').replace(/ /g,'&nbsp;');
			$('#testRestCallResult').html(formatted);
		}).onError(function(errorMsg){
			showError(errorMsg?(errorMsg.message?errorMsg.message:errorMsg):'An exception was caught!');
		});
	});

	$('#apiDetailPlaceholder').hide();
	$('#apiDetailContent').show();
}

parsePayload = function(txt){
	try{
		return JSON.parse(txt);
	}catch(e){
		showError('Invalid JSON payload: '+e.message);
		return {};
	}
}

/*--- Tree init & model ---*/

var apiBrowser = null;

initApiBrowser = function(){
	let resizeTree = function(){
		let height = $('#card').height() - 40;
		$('#apiTreeArea').css({'height': height+'px', 'max-height': height+'px', 'overflow': 'auto'});
		let detailHeight = height;
		$('#apiDetailArea').css({'height': detailHeight+'px', 'max-height': detailHeight+'px', 'overflow': 'auto'});
		$('#testRestCallResultArea').css({'height': '200px', 'max-height': '200px'});
	};
	resizeTree();
	$(window).on('resize', resizeTree);

	$('#selectApiHint').text(npaUi.getLocalizedString('@apaf.api.explorer.select.hint'));

	$('#apiTreeArea').empty();
	apiBrowser = new TreeViewer('apiBrowser', $('#apiTreeArea')[0]);
	apiBrowser.init();
	apiBrowser.setVisitor(apiVisitor);
	apiBrowser.setDecorator(apiDecorator);
	apiBrowser.setEventListener(apiEventListener);

	apaf.call({
		"method": "GET",
		"uri": "/apaf-api-management/find",
		"payload": {}
	}).then(function(data){
		let model = createApiModel(data);
		apiBrowser.addRootData(model);
		apiBrowser.refreshTree();
	}).onError(function(errorMsg){
		showError(errorMsg.message?errorMsg.message:errorMsg);
	});
}

createApiModel = function(apiData){
	let apafRoot = {"name": "APAF Runtime", "type": "root", "plugins": []};
	let plugins = {};
	let apis = sortOn(apiData.apis, 'pluginId');
	for(var i=0;i<apis.length;i++){
		let api = apis[i];
		if(!plugins[api.pluginId]){
			plugins[api.pluginId] = {"name": api.pluginId, "type": "plugin", "apis": []};
		}
		let fullPath = apiData.routers[api.api.router];
		if(typeof fullPath != 'undefined'){
			let uri = fullPath + api.api.schema;
			let item = {
				"name": api.api.id,
				"type": "api",
				"method": api.api.method,
				"uri": uri,
				"securityRole": api.api.securityRole || 'n/a',
				"description": api.api.description || 'no description available'
			};
			if(api.api.input) item.input = api.api.input;
			plugins[api.pluginId].apis.push(item);
		}
	}
	for(var pluginId in plugins){
		apafRoot.plugins.push(plugins[pluginId]);
	}
	return apafRoot;
}
