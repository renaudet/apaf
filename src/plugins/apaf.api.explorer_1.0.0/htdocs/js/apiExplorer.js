/*
 * apiExplorer.js - main javascript resource for the APAF API Explorer Page
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const API_FIND_URI = '/apaf-api-management/find';
const REST_INVOKE_URI = '/apaf-rest/invoke';
const REMOTE_PROVIDERS_URI = '/apaf-api-explorer-api/remoteProviders';

const METHOD_COLORS = {
	'GET':    '#61affe',
	'POST':   '#49cc90',
	'PUT':    '#fca130',
	'DELETE': '#f93e3e'
};

/*
 * remoteContext variants:
 *   null                          → local mode
 *   { _mode:'manual', host, ...}  → manual remote context (forwarded to /apaf-rest/invoke)
 *   { _mode:'link', linkId, linkName, label } → APAF Link context (forwarded to /apaf-link/invoke)
 */
var remoteContext = null;

// provider discovered via the apaf.remote.context.provider extension point
// { label, queryUri, invokeUri } — null when no provider is available
var remoteProvider = null;

// active modal tab: 'manual' | 'link'
var activeRemoteTab = 'manual';

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.render();
			localizeUi();
			// discover remote context providers before wiring up controls
			apaf.call({
				"method": "GET",
				"uri": REMOTE_PROVIDERS_URI,
				"payload": {}
			}).then(function(providers){
				if(providers && providers.length>0){
					// use the first registered provider
					remoteProvider = providers[0];
				}
				initRemoteControls();
				initApiBrowser();
			}).onError(function(){
				// no provider available — proceed without link support
				initRemoteControls();
				initApiBrowser();
			});
		});
	});
}

unescapeI18N = function(labelId){
	return $('<div />').html(npaUi.getLocalizedString(labelId)).text();
}

/*--- i18n ---*/

localizeUi = function(){
	$('#labelUri').html(npaUi.getLocalizedString('@apaf.api.explorer.label.uri'));
	$('#labelPayload').html(npaUi.getLocalizedString('@apaf.api.explorer.label.payload'));
	$('#labelResult').html(npaUi.getLocalizedString('@apaf.api.explorer.label.result'));
	$('#copyResultBtn').attr('title', unescapeI18N('@apaf.api.explorer.btn.copy.tooltip'));
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
	$('#remoteModalLinkLabel').html(npaUi.getLocalizedString('@apaf.api.explorer.modal.link'));
	$('#tabManual').html(npaUi.getLocalizedString('@apaf.api.explorer.modal.tab.manual'));
	$('#tabLink').html(npaUi.getLocalizedString('@apaf.api.explorer.modal.tab.link'));
}

/*--- Remote context controls ---*/

switchRemoteTab = function(tab){
	activeRemoteTab = tab;
	if(tab=='manual'){
		$('#tabManual').addClass('active');
		$('#tabLink').removeClass('active');
		$('#remoteTabManual').show();
		$('#remoteTabLink').hide();
	}else{
		$('#tabLink').addClass('active');
		$('#tabManual').removeClass('active');
		$('#remoteTabLink').show();
		$('#remoteTabManual').hide();
	}
}

loadLinkOptions = function(){
	if(!remoteProvider){
		// no provider registered: hide the link tab entirely
		$('#tabLink').hide();
		$('#remoteLinkSelect').empty().append('<option value="">'+unescapeI18N('@apaf.api.explorer.modal.link.unavailable')+'</option>');
		return;
	}
	$('#tabLink').show();
	apaf.call({
		"method": "POST",
		"uri": remoteProvider.queryUri,
		"payload": {"selector": {"enabled": {"$eq": true}}}
	}).then(function(links){
		let select = $('#remoteLinkSelect');
		select.empty();
		select.append('<option value=""></option>');
		if(links && links.length>0){
			for(var i=0;i<links.length;i++){
				let lnk = links[i];
				let label = lnk.name + (lnk.description ? ' — '+lnk.description : '');
				select.append('<option value="'+lnk.id+'" data-name="'+lnk.name+'" data-label="'+label+'">'+label+'</option>');
			}
		}
		// if current context is a link, pre-select it
		if(remoteContext && remoteContext._mode=='link'){
			select.val(remoteContext.linkId);
			showLinkInfo(remoteContext.label);
		}else{
			$('#remoteLinkInfo').hide();
		}
	}).onError(function(errorMsg){
		// provider registered but query failed; silently degrade
		$('#remoteLinkSelect').empty().append('<option value="">'+unescapeI18N('@apaf.api.explorer.modal.link.unavailable')+'</option>');
	});

	$('#remoteLinkSelect').off('change.linksel').on('change.linksel',function(){
		let selected = $(this).find('option:selected');
		let lbl = selected.data('label')||'';
		if(lbl) showLinkInfo(lbl); else $('#remoteLinkInfo').hide();
	});
}

showLinkInfo = function(label){
	$('#remoteLinkInfoText').text(label);
	$('#remoteLinkInfo').show();
}

initRemoteControls = function(){
	// tab switching
	$('[data-remote-tab]').on('click', function(){
		switchRemoteTab($(this).data('remote-tab'));
	});

	$('#remoteBtn').on('click', function(){
		// pre-fill manual tab if context already set in manual mode
		if(remoteContext && remoteContext._mode=='manual'){
			$('#remoteHost').val(remoteContext.host);
			$('#remotePort').val(remoteContext.port || '');
			$('#remoteSecured').prop('checked', remoteContext.secured || false);
			$('#remoteAcceptCert').prop('checked', remoteContext.acceptCertificate || false);
			$('#remoteUsername').val(remoteContext.username || '');
			$('#remotePassword').val(remoteContext.password || '');
			switchRemoteTab('manual');
		}else if(remoteContext && remoteContext._mode=='link'){
			switchRemoteTab('link');
		}else{
			$('#remoteHost').val('');
			$('#remotePort').val('');
			$('#remoteSecured').prop('checked', false);
			$('#remoteAcceptCert').prop('checked', false);
			$('#remoteUsername').val('');
			$('#remotePassword').val('');
			switchRemoteTab('manual');
		}
		loadLinkOptions();
		$('#remoteContextModal').show();
	});

	$('#remoteModalCloseBtn, #remoteModalCancelBtn').on('click', function(){
		$('#remoteContextModal').hide();
	});

	$('#remoteModalConnectBtn').on('click', function(){
		if(activeRemoteTab=='manual'){
			let host = $('#remoteHost').val().trim();
			if(!host){
				showError(npaUi.getLocalizedString('@apaf.api.explorer.modal.host.required'));
				return;
			}
			remoteContext = {
				_mode:             'manual',
				host:              host,
				port:              parseInt($('#remotePort').val()) || null,
				secured:           $('#remoteSecured').is(':checked'),
				acceptCertificate: $('#remoteAcceptCert').is(':checked'),
				username:          $('#remoteUsername').val().trim() || null,
				password:          $('#remotePassword').val() || null
			};
			if(!remoteContext.port)     delete remoteContext.port;
			if(!remoteContext.username) delete remoteContext.username;
			if(!remoteContext.password) delete remoteContext.password;
		}else{
			// link mode
			let selected = $('#remoteLinkSelect option:selected');
			let linkId = $('#remoteLinkSelect').val();
			if(!linkId){
				showError(npaUi.getLocalizedString('@apaf.api.explorer.modal.link.required'));
				return;
			}
			remoteContext = {
				_mode:     'link',
				linkId:    linkId,
				linkName:  selected.data('name'),
				label:     selected.data('label') || selected.data('name')
			};
		}
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
		let label;
		if(remoteContext._mode=='link'){
			label = remoteContext.label || remoteContext.linkName;
		}else{
			label = (remoteContext.secured ? 'https' : 'http') + '://' + remoteContext.host;
			if(remoteContext.port) label += ':' + remoteContext.port;
		}
		$('#remoteStatusLabel').text(label);
		$('#remoteStatusBar').show();
		$('#remoteBtn').addClass('btn-warning').removeClass('btn-outline-secondary');
	}else{
		$('#remoteStatusBar').hide();
		$('#remoteBtn').removeClass('btn-warning').addClass('btn-outline-secondary');
	}
}

/*--- REST invocation helpers ---*/

invokeRemote = function(method, uri, payload, onSuccess, onError){
	if(remoteContext._mode=='link'){
		// forward via the registered remote context provider
		let invokePayload = {
			linkId:  remoteContext.linkId,
			method:  method,
			uri:     uri,
			payload: payload
		};
		apaf.call({
			"method": "POST",
			"uri": remoteProvider.invokeUri,
			"payload": invokePayload
		}).then(function(response){
			onSuccess(response.data !== undefined ? response.data : response);
		}).onError(onError);
	}else{
		// via /apaf-rest/invoke (manual context)
		let invokePayload = Object.assign({}, remoteContext, {
			_mode:   undefined,
			method:  method,
			uri:     uri,
			payload: payload
		});
		delete invokePayload._mode;
		apaf.call({
			"method": "POST",
			"uri": REST_INVOKE_URI,
			"payload": invokePayload
		}).then(function(response){
			onSuccess(response.data !== undefined ? response.data : response);
		}).onError(onError);
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
			invokeRemote(method, targetUri, payload,
				function(data){ renderResult(data); },
				function(errorMsg){ showError(errorMsg?(errorMsg.message?errorMsg.message:errorMsg):'An exception was caught!'); }
			);
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
		invokeRemote('GET', API_FIND_URI, {},
			function(apiData){
				let model = createApiModel(apiData);
				apiBrowser.addRootData(model);
				apiBrowser.refreshTree();
			},
			function(errorMsg){ showError(errorMsg.message?errorMsg.message:errorMsg); }
		);
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
