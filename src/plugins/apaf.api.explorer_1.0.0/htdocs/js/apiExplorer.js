/*
 * apiExplorer.js - main javascript resource for the APAF API Explorer Page
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const API_FIND_URI = '/apaf-api-management/find';
const REST_INVOKE_URI = '/apaf-rest/invoke';

const METHOD_COLORS = {
	'GET':    '#61affe',
	'POST':   '#49cc90',
	'PUT':    '#fca130',
	'DELETE': '#f93e3e'
};

// null = local mode; object = remote mode
var remoteContext = null;

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.render();
			localizeUi();
			initRemoteControls();
			initApiBrowser();
		});
	});
}

/*--- i18n ---*/

localizeUi = function(){
	$('#labelUri').html(npaUi.getLocalizedString('@apaf.api.explorer.label.uri'));
	$('#labelPayload').html(npaUi.getLocalizedString('@apaf.api.explorer.label.payload'));
	$('#labelResult').html(npaUi.getLocalizedString('@apaf.api.explorer.label.result'));
	$('#copyResultBtn').attr('title', npaUi.getLocalizedString('@apaf.api.explorer.btn.copy.tooltip'));
	$('#testRestCallBtn').html(npaUi.getLocalizedString('@apaf.api.explorer.btn.test'));
	$('#remoteBtn').html(npaUi.getLocalizedString('@apaf.api.explorer.btn.remote'));
	$('#clearRemoteBtn').html(npaUi.getLocalizedString('@apaf.api.explorer.btn.clear'));
	$('#remoteModalTitle').html(npaUi.getLocalizedString('@apaf.api.explorer.modal.title'));
	$('#remoteModalHostLabel').html(npaUi.getLocalizedString('@apaf.api.explorer.modal.host'));
	$('#remoteSecuredLabel').html(npaUi.getLocalizedString('@apaf.api.explorer.modal.secured'));
	$('#remoteAcceptCertLabel').html(npaUi.getLocalizedString('@apaf.api.explorer.modal.accept.cert'));
	$('#remoteModalUserLabel').html(npaUi.getLocalizedString('@apaf.api.explorer.modal.username'));
	$('#remoteModalPwdLabel').html(npaUi.getLocalizedString('@apaf.api.explorer.modal.password'));
	$('#remoteModalCancelBtn').html(npaUi.getLocalizedString('@apaf.api.explorer.modal.cancel'));
	$('#remoteModalConnectBtn').html(npaUi.getLocalizedString('@apaf.api.explorer.modal.connect'));
}

/*--- Remote context controls ---*/

initRemoteControls = function(){
	$('#remoteBtn').on('click', function(){
		// pre-fill modal if context already set
		if(remoteContext){
			$('#remoteHost').val(remoteContext.host);
			$('#remotePort').val(remoteContext.port || '');
			$('#remoteSecured').prop('checked', remoteContext.secured || false);
			$('#remoteAcceptCert').prop('checked', remoteContext.acceptCertificate || false);
			$('#remoteUsername').val(remoteContext.username || '');
			$('#remotePassword').val(remoteContext.password || '');
		}else{
			$('#remoteHost').val('');
			$('#remotePort').val('');
			$('#remoteSecured').prop('checked', false);
			$('#remoteAcceptCert').prop('checked', false);
			$('#remoteUsername').val('');
			$('#remotePassword').val('');
		}
		$('#remoteContextModal').show();
	});

	$('#remoteModalCloseBtn, #remoteModalCancelBtn').on('click', function(){
		$('#remoteContextModal').hide();
	});

	$('#remoteModalConnectBtn').on('click', function(){
		let host = $('#remoteHost').val().trim();
		if(!host){
			showError(npaUi.getLocalizedString('@apaf.api.explorer.modal.host.required'));
			return;
		}
		remoteContext = {
			host:              host,
			port:              parseInt($('#remotePort').val()) || null,
			secured:           $('#remoteSecured').is(':checked'),
			acceptCertificate: $('#remoteAcceptCert').is(':checked'),
			username:          $('#remoteUsername').val().trim() || null,
			password:          $('#remotePassword').val() || null
		};
		if(!remoteContext.port) delete remoteContext.port;
		if(!remoteContext.username) delete remoteContext.username;
		if(!remoteContext.password) delete remoteContext.password;
		$('#remoteContextModal').hide();
		updateRemoteStatusBar();
		loadApiList();
	});

	$('#clearRemoteBtn').on('click', function(){
		remoteContext = null;
		updateRemoteStatusBar();
		loadApiList();
	});
}

updateRemoteStatusBar = function(){
	if(remoteContext){
		let label = (remoteContext.secured ? 'https' : 'http') + '://' + remoteContext.host;
		if(remoteContext.port) label += ':' + remoteContext.port;
		$('#remoteStatusLabel').text(label);
		$('#remoteStatusBar').show();
		$('#remoteBtn').addClass('btn-warning').removeClass('btn-outline-secondary');
	}else{
		$('#remoteStatusBar').hide();
		$('#remoteBtn').removeClass('btn-warning').addClass('btn-outline-secondary');
	}
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

	let headerHtml = '<span class="api-method-badge api-method-badge-lg" style="background-color:'+color+';">'+api.method+'</span>';
	headerHtml += '&nbsp;<span class="api-detail-uri">'+api.uri+'</span>';
	$('#apiDetailHeader').html(headerHtml);

	$('#apiDetailDescription').text(api.description || '');

	$('#apiSecurityLabel').html(
		'<b>'+npaUi.getLocalizedString('@apaf.api.explorer.label.security')+'</b>&nbsp;'
		+'<span class="api-security-badge">'+(api.securityRole||'none')+'</span>'
	);

	if(('POST'==api.method || 'PUT'==api.method) && api.input){
		$('#apiInputLabel').html('<b>'+npaUi.getLocalizedString('@apaf.api.explorer.label.request.body')+'</b>').show();
		let txt = (typeof api.input=='object') ? JSON.stringify(api.input,null,'  ') : api.input;
		$('#apiInputContent').text(txt).show();
	}else{
		$('#apiInputLabel').hide();
		$('#apiInputContent').hide();
	}

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

		if(remoteContext){
			// indirect call via /apaf-rest/invoke
			let invokePayload = Object.assign({}, remoteContext, {
				method:  method,
				uri:     targetUri,
				payload: payload
			});
			apaf.call({
				"method": "POST",
				"uri": REST_INVOKE_URI,
				"payload": invokePayload
			}).then(function(response){
				renderResult(response.data !== undefined ? response.data : response);
			}).onError(function(errorMsg){
				showError(errorMsg?(errorMsg.message?errorMsg.message:errorMsg):'An exception was caught!');
			});
		}else{
			// direct local call
			apaf.call({
				"method": method,
				"uri": targetUri,
				"payload": payload
			}).then(function(data){
				renderResult(data);
			}).onError(function(errorMsg){
				showError(errorMsg?(errorMsg.message?errorMsg.message:errorMsg):'An exception was caught!');
			});
		}
	});

	$('#apiDetailPlaceholder').hide();
	$('#apiDetailContent').show();
}

renderResult = function(data){
	if(data===null || data===undefined){
		$('#testRestCallResult').html('[&nbsp;]');
		return;
	}
	let formatted = JSON.stringify(data,null,'  ')
		.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
		.replace(/\n/g,'<br>').replace(/ /g,'&nbsp;');
	$('#testRestCallResult').html(formatted);
}

parsePayload = function(txt){
	try{
		return JSON.parse(txt);
	}catch(e){
		showError('Invalid JSON payload: '+e.message);
		return {};
	}
}

/*--- API list loading (local or remote) ---*/

loadApiList = function(){
	$('#apiTreeArea').empty();
	apiBrowser = new TreeViewer('apiBrowser', $('#apiTreeArea')[0]);
	apiBrowser.init();
	apiBrowser.setVisitor(apiVisitor);
	apiBrowser.setDecorator(apiDecorator);
	apiBrowser.setEventListener(apiEventListener);

	// reset detail panel
	$('#apiDetailContent').hide();
	$('#apiDetailPlaceholder').show();

	if(remoteContext){
		let invokePayload = Object.assign({}, remoteContext, {
			method: 'GET',
			uri:    API_FIND_URI
		});
		apaf.call({
			"method": "POST",
			"uri": REST_INVOKE_URI,
			"payload": invokePayload
		}).then(function(response){
			let apiData = response.data !== undefined ? response.data : response;
			let model = createApiModel(apiData);
			apiBrowser.addRootData(model);
			apiBrowser.refreshTree();
		}).onError(function(errorMsg){
			showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	}else{
		apaf.call({
			"method": "GET",
			"uri": API_FIND_URI,
			"payload": {}
		}).then(function(data){
			let model = createApiModel(data);
			apiBrowser.addRootData(model);
			apiBrowser.refreshTree();
		}).onError(function(errorMsg){
			showError(errorMsg.message?errorMsg.message:errorMsg);
		});
	}
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

/*--- Browser init ---*/

var apiBrowser = null;

initApiBrowser = function(){
	let resizeColumns = function(){
		let workAreaHeight = $('#workArea').height();
		if(workAreaHeight && workAreaHeight > 0){
			$('#apiLeftCol').css({'height': workAreaHeight+'px'});
			$('#apiDetailArea').css({'height': workAreaHeight+'px', 'overflow-y': 'auto'});
		}
	};
	setTimeout(resizeColumns, 100);
	$(window).on('resize', function(){
		setTimeout(resizeColumns, 50);
	});

	$('#selectApiHint').text(npaUi.getLocalizedString('@apaf.api.explorer.select.hint'));

	$('#copyResultBtn').on('click', function(){
		let text = $('#testRestCallResult').text().replace(/\u00a0/g,' ');
		if(navigator.clipboard){
			navigator.clipboard.writeText(text);
		}else{
			let ta = document.createElement('textarea');
			ta.value = text;
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
		}
		flash('@apaf.api.explorer.btn.copy.flash');
	});

	loadApiList();
}
