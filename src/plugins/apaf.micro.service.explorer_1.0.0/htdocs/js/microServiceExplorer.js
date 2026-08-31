/*
 * microServiceExplorer.js - main javascript resource for the APAF Micro-Service Explorer page
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const MS_QUERY_URI  = '/apaf-micro-services-api/query';
const REST_INVOKE_URI = '/apaf-rest/invoke';
const REMOTE_PROVIDERS_URI = '/apaf-micro-service-explorer-api/remoteProviders';

// Invocation base path on the target APAF instance
const MS_INVOKE_BASE = '/apaf-micro-services-api/api';

const METHOD_COLORS = {
	'GET':    '#61affe',
	'POST':   '#49cc90',
	'PUT':    '#fca130',
	'DELETE': '#f93e3e'
};

/*
 * remoteContext variants:
 *   null                          → local mode
 *   { _mode:'manual', host, ...}  → manual remote context (via /apaf-rest/invoke)
 *   { _mode:'link', linkId, ... } → APAF Link context (via registered provider)
 */
var remoteContext = null;

// remote context provider discovered via apaf.remote.context.provider extension point
var remoteProvider = null;

// active modal tab: 'manual' | 'link'
var activeRemoteTab = 'manual';

// currently selected micro-service record
var selectedService = null;

/*--- Bootstrap ---*/

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE, function(){
		npaUi.initialize(function(){
			npaUi.render();
			localizeUi();
			apaf.call({
				"method": "GET",
				"uri": REMOTE_PROVIDERS_URI,
				"payload": {}
			}).then(function(providers){
				if(providers && providers.length > 0){
					remoteProvider = providers[0];
				}else{
					$('#tabLink').hide();
				}
				initRemoteControls();
				loadServiceList();
			}).onError(function(){
				$('#tabLink').hide();
				initRemoteControls();
				loadServiceList();
			});
		});
	});
}

/*--- i18n ---*/

unescapeI18N = function(labelId){
	return $('<div />').html(npaUi.getLocalizedString(labelId)).text();
}

localizeUi = function(){
	$('#labelUri').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.label.uri'));
	$('#labelPayload').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.label.payload'));
	$('#labelResult').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.label.result'));
	$('#copyResultBtn').attr('title', unescapeI18N('@apaf.micro.service.explorer.btn.copy.tooltip'));
	$('#testBtn').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.btn.test'));
	$('#remoteBtn').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.btn.remote'));
	$('#clearRemoteBtn').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.btn.clear'));
	$('#remoteModalTitle').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.modal.title'));
	$('#remoteModalHostLabel').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.modal.host'));
	$('#remoteSecuredLabel').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.modal.secured'));
	$('#remoteAcceptCertLabel').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.modal.accept.cert'));
	$('#remoteModalUserLabel').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.modal.username'));
	$('#remoteModalPwdLabel').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.modal.password'));
	$('#remoteModalCancelBtn').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.modal.cancel'));
	$('#remoteModalConnectBtn').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.modal.connect'));
	$('#remoteModalLinkLabel').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.modal.link'));
	$('#tabManual').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.modal.tab.manual'));
	$('#tabLink').html(npaUi.getLocalizedString('@apaf.micro.service.explorer.modal.tab.link'));
	$('#selectHint').text(unescapeI18N('@apaf.micro.service.explorer.select.hint'));
}

/*--- Remote context controls ---*/

switchRemoteTab = function(tab){
	activeRemoteTab = tab;
	if(tab == 'manual'){
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
		$('#remoteLinkSelect').empty().append('<option value="">'+unescapeI18N('@apaf.micro.service.explorer.modal.link.unavailable')+'</option>');
		return;
	}
	apaf.call({
		"method": "POST",
		"uri": remoteProvider.queryUri,
		"payload": {"selector": {"enabled": {"$eq": true}}}
	}).then(function(links){
		let select = $('#remoteLinkSelect');
		select.empty();
		select.append('<option value=""></option>');
		if(links && links.length > 0){
			for(var i = 0; i < links.length; i++){
				let lnk = links[i];
				let label = lnk.name + (lnk.description ? ' — ' + lnk.description : '');
				select.append('<option value="'+lnk.id+'" data-name="'+lnk.name+'" data-label="'+label+'">'+label+'</option>');
			}
		}
		if(remoteContext && remoteContext._mode == 'link'){
			select.val(remoteContext.linkId);
			showLinkInfo(remoteContext.label);
		}else{
			$('#remoteLinkInfo').hide();
		}
	}).onError(function(){
		$('#remoteLinkSelect').empty().append('<option value="">'+unescapeI18N('@apaf.micro.service.explorer.modal.link.unavailable')+'</option>');
	});
	$('#remoteLinkSelect').off('change.linksel').on('change.linksel', function(){
		let selected = $(this).find('option:selected');
		let lbl = selected.data('label') || '';
		if(lbl) showLinkInfo(lbl); else $('#remoteLinkInfo').hide();
	});
}

showLinkInfo = function(label){
	$('#remoteLinkInfoText').text(label);
	$('#remoteLinkInfo').show();
}

initRemoteControls = function(){
	$('[data-remote-tab]').on('click', function(){
		switchRemoteTab($(this).data('remote-tab'));
	});

	$('#remoteBtn').on('click', function(){
		if(remoteContext && remoteContext._mode == 'manual'){
			$('#remoteHost').val(remoteContext.host);
			$('#remotePort').val(remoteContext.port || '');
			$('#remoteSecured').prop('checked', remoteContext.secured || false);
			$('#remoteAcceptCert').prop('checked', remoteContext.acceptCertificate || false);
			$('#remoteUsername').val(remoteContext.username || '');
			$('#remotePassword').val(remoteContext.password || '');
			switchRemoteTab('manual');
		}else if(remoteContext && remoteContext._mode == 'link'){
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
		if(activeRemoteTab == 'manual'){
			let host = $('#remoteHost').val().trim();
			if(!host){
				showError(npaUi.getLocalizedString('@apaf.micro.service.explorer.modal.host.required'));
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
			let selected = $('#remoteLinkSelect option:selected');
			let linkId = $('#remoteLinkSelect').val();
			if(!linkId){
				showError(npaUi.getLocalizedString('@apaf.micro.service.explorer.modal.link.required'));
				return;
			}
			remoteContext = {
				_mode:    'link',
				linkId:   linkId,
				linkName: selected.data('name'),
				label:    selected.data('label') || selected.data('name')
			};
		}
		$('#remoteContextModal').hide();
		updateRemoteStatusBar();
		loadServiceList();
	});

	$('#clearRemoteBtn').on('click', function(){
		remoteContext = null;
		updateRemoteStatusBar();
		loadServiceList();
	});

	$('#refreshBtn').on('click', function(){
		loadServiceList();
	});

	$('#copyResultBtn').on('click', function(){
		let text = $('#testResult').text();
		if(navigator.clipboard){
			navigator.clipboard.writeText(text).then(function(){
				showFlash(npaUi.getLocalizedString('@apaf.micro.service.explorer.btn.copy.flash'));
			});
		}
	});
}

updateRemoteStatusBar = function(){
	if(remoteContext){
		let label;
		if(remoteContext._mode == 'link'){
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

/*--- Remote invocation helper ---*/

invokeRemote = function(method, uri, payload, onSuccess, onError){
	if(remoteContext._mode == 'link'){
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
		let invokePayload = Object.assign({}, remoteContext, {
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

/*--- Service list rendering ---*/

loadServiceList = function(){
	let listEl = $('#msList');
	listEl.empty();
	selectedService = null;
	$('#msDetailContent').hide();
	$('#msDetailPlaceholder').show();

	let doQuery = function(onSuccess, onError){
		if(remoteContext){
			invokeRemote('POST', MS_QUERY_URI, {}, onSuccess, onError);
		}else{
			apaf.call({
				"method": "POST",
				"uri": MS_QUERY_URI,
				"payload": {}
			}).then(onSuccess).onError(onError);
		}
	};

	doQuery(function(data){
		if(!data || data.length == 0){
			listEl.html('<div style="padding:12px; color:#888; font-style:italic; font-size:0.85rem;">'+unescapeI18N('@apaf.micro.service.explorer.list.empty')+'</div>');
			return;
		}
		let sorted = data.slice().sort(function(a,b){
			let n = (a.name||'').localeCompare(b.name||'');
			return n != 0 ? n : (a.version||'').localeCompare(b.version||'');
		});
		for(var i = 0; i < sorted.length; i++){
			renderListItem(sorted[i], listEl);
		}
	}, function(errorMsg){
		showError(errorMsg ? (errorMsg.message ? errorMsg.message : errorMsg) : 'An error occurred');
	});
}

renderListItem = function(svc, listEl){
	let color = METHOD_COLORS[svc.method] || '#aaa';
	let badge = '<span class="mse-method-badge" style="background-color:'+color+';">'+( svc.method||'?')+'</span>';
	let disabledClass = svc.enabled ? '' : ' mse-list-item-disabled';
	let item = $('<div class="mse-list-item'+disabledClass+'" data-id="'+svc.id+'"></div>');
	item.html(badge+'<span class="mse-list-item-name">'+escapeHtml(svc.name)+'</span><span class="mse-list-item-version">v'+escapeHtml(svc.version)+'</span>');
	item.on('click', function(){
		$('.mse-list-item').removeClass('active');
		$(this).addClass('active');
		showServiceDetail(svc);
	});
	listEl.append(item);
}

escapeHtml = function(str){
	if(!str) return '';
	return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/*--- Service detail rendering ---*/

showServiceDetail = function(svc){
	selectedService = svc;
	let color = METHOD_COLORS[svc.method] || '#aaa';
	let badge = '<span class="mse-method-badge mse-method-badge-lg" style="background-color:'+color+';">'+(svc.method||'?')+'</span>';

	$('#msDetailHeader').html(
		badge
		+'<span class="mse-detail-name">'+escapeHtml(svc.name)+'</span>'
		+'<span class="mse-detail-version">v'+escapeHtml(svc.version)+'</span>'
		+(svc.enabled
			? ''
			: '&nbsp;<span class="badge bg-secondary" style="font-size:0.7rem;">disabled</span>')
	);

	$('#msDetailDescription').text(svc.description || '');

	$('#msSecurityLabel').html(
		'<b>'+npaUi.getLocalizedString('@apaf.micro.service.explorer.label.security')+'</b>&nbsp;'
		+'<span class="mse-security-badge">'+(svc.restrictedToRole||'none')+'</span>'
	);

	let invocationUri = MS_INVOKE_BASE + '/' + encodeURIComponent(svc.name) + '/' + encodeURIComponent(svc.version);
	$('#msUriLabel').html(
		'<b>'+npaUi.getLocalizedString('@apaf.micro.service.explorer.label.uri')+'</b>&nbsp;'
		+'<span class="mse-uri-value">'+escapeHtml(invocationUri)+'</span>'
	);

	// Render apiDoc if present
	if(svc.apiDoc && typeof svc.apiDoc == 'object'){
		renderApiDoc(svc.apiDoc);
		$('#msApiDocSection').show();
	}else{
		$('#msApiDocSection').hide();
	}

	// Set up test panel
	$('#testUri').val(invocationUri);
	$('#testResult').html('');

	if(svc.method == 'POST' || svc.method == 'PUT'){
		$('#payloadRow').show();
		// Pre-fill payload from apiDoc parameters if available
		let sample = buildPayloadSample(svc.apiDoc);
		$('#payload').val(sample);
	}else{
		$('#payloadRow').hide();
	}

	$('#testBtn').off('.mstest').on('click.mstest', function(){
		runTest(svc);
	});

	$('#msDetailPlaceholder').hide();
	$('#msDetailContent').show();
}

renderApiDoc = function(apiDoc){
	let html = '';
	if(apiDoc.summary){
		html += '<div class="mse-apidoc-summary">'+escapeHtml(apiDoc.summary)+'</div>';
	}
	if(apiDoc.description && apiDoc.description != apiDoc.summary){
		html += '<div class="mse-apidoc-summary" style="margin-bottom:6px;">'+escapeHtml(apiDoc.description)+'</div>';
	}
	if(apiDoc.parameters && apiDoc.parameters.length > 0){
		html += '<div style="font-size:0.78rem; font-weight:bold; color:#555; margin-bottom:3px;">'+unescapeI18N('@apaf.micro.service.explorer.apidoc.parameters')+'</div>';
		for(var i = 0; i < apiDoc.parameters.length; i++){
			let p = apiDoc.parameters[i];
			let required = p.required ? '<span class="mse-apidoc-param-required">*</span>' : '';
			html += '<div class="mse-apidoc-param">'
				+'<span class="mse-apidoc-param-name">'+escapeHtml(p.name||'')+'</span>'
				+'<span class="mse-apidoc-param-type">'+escapeHtml(p.type||'any')+'</span>'
				+required
				+'<span class="mse-apidoc-param-desc">'+escapeHtml(p.description||'')+'</span>'
				+'</div>';
		}
	}
	$('#msApiDocLabel').html('<b>'+npaUi.getLocalizedString('@apaf.micro.service.explorer.apidoc.title')+'</b>');
	$('#msApiDocContent').html(html || '<span style="color:#888;font-style:italic;">no descriptor</span>');
}

buildPayloadSample = function(apiDoc){
	if(!apiDoc || !apiDoc.parameters || apiDoc.parameters.length == 0) return '{\n}';
	let sample = {};
	for(var i = 0; i < apiDoc.parameters.length; i++){
		let p = apiDoc.parameters[i];
		let name = p.name || ('param'+i);
		let type = (p.type||'string').toLowerCase();
		if(type == 'number' || type == 'integer') sample[name] = 0;
		else if(type == 'boolean') sample[name] = false;
		else if(type == 'array') sample[name] = [];
		else if(type == 'object') sample[name] = {};
		else sample[name] = '';
	}
	return JSON.stringify(sample, null, '  ');
}

/*--- Test execution ---*/

runTest = function(svc){
	$('#testResult').html('<i>Calling...</i>');
	let uri     = $('#testUri').val().trim();
	let method  = svc.method;
	let payload = (method == 'POST' || method == 'PUT') ? parsePayload($('#payload').val()) : {};

	if(remoteContext){
		invokeRemote(method, uri, payload,
			function(data){ renderResult(data); },
			function(errorMsg){ showError(errorMsg ? (errorMsg.message ? errorMsg.message : errorMsg) : 'An exception was caught!'); }
		);
	}else{
		apaf.call({
			"method": method,
			"uri": uri,
			"payload": payload
		}).then(function(data){
			renderResult(data);
		}).onError(function(errorMsg){
			showError(errorMsg ? (errorMsg.message ? errorMsg.message : errorMsg) : 'An exception was caught!');
		});
	}
}

renderResult = function(data){
	if(data === null || data === undefined){
		$('#testResult').html('[&nbsp;]');
		return;
	}
	let formatted = JSON.stringify(data, null, '  ')
		.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
	$('#testResult').html(formatted);
}

parsePayload = function(txt){
	try{
		return JSON.parse(txt);
	}catch(e){
		showError('Invalid JSON payload: ' + e.message);
		return {};
	}
}

/*--- Column resize ---*/

$(function(){
	let resizeColumns = function(){
		let h = $('#workArea').height();
		if(h && h > 0){
			$('#msLeftCol').css({'height': h + 'px'});
			$('#msDetailArea').css({'height': h + 'px', 'overflow-y': 'auto'});
		}
	};
	setTimeout(resizeColumns, 100);
	$(window).on('resize', function(){ setTimeout(resizeColumns, 50); });
});
