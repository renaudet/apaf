/*
 * manageUpdates.js - main javascript resource for the APAF Update Manager Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const CHECK_FOR_UPDATES_ACTION_ID = 'checkForUpdates';
const ROLLBACK_ACTION_ID = 'rollbackUpdates';
const CARD_ID = 'updaterCard';
const TOOLBAR_ID = 'updaterToolbar';

/* ===== State ===== */
var treeViewer = null;
var installedPlugins = [];   // [{ id, version, name, siteId, requires[] }]
var updateDiff = null;       // { added[], updated[], removed[] } — null = not yet checked

/* ===== Entry point ===== */

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.onComponentLoaded = onComponentLoaded;
			npaUi.on(CHECK_FOR_UPDATES_ACTION_ID, checkForUpdates);
			npaUi.on(ROLLBACK_ACTION_ID, openRollbackDialog);
			npaUi.render();
		});
	});
}

onComponentLoaded = function(){
	localizeUi();
	loadInstalledPlugins();
}

/* ===== i18n ===== */

decodeHtmlEntities = function(str){
	if(!str) return '';
	return $('<textarea>').html(str).text();
}

localizeUi = function(){
	$('#updHintText').html(npaUi.getLocalizedString('@apaf.updater.hint'));
	$('#updDetailDepsTitle').html(npaUi.getLocalizedString('@apaf.updater.detail.deps.title'));
}

/* ===== Status bar ===== */

setStatus = function(status){
	let card = $apaf(CARD_ID);
	if(card) card.setStatus(status);
}

/* ===== Load installed plugins ===== */

loadInstalledPlugins = function(){
	setStatus(npaUi.getLocalizedString('@apaf.updater.loading'));
	apaf.call({
		"method": "GET",
		"uri": "/apaf-updater/installed",
		"payload": {}
	}).then(function(data){
		installedPlugins = data;
		buildTree();
		setStatus(npaUi.getLocalizedString('@apaf.updater.status.loaded',[installedPlugins.length]));
	}).onError(function(msg){
		showError(msg);
	});
}

/* ===== Tree building ===== */

/*
 * Build (or rebuild) the plugin tree from installedPlugins + optional updateDiff.
 * Each tree node data = { plugin, status } where status ∈ 'ok'|'updated'|'added'|'removed'
 */
buildTree = function(){
	// Build a lookup index for update statuses
	let statusIndex = {};
	if(updateDiff){
		for(let i=0;i<updateDiff.updated.length;i++){
			statusIndex[updateDiff.updated[i].id] = { kind:'updated', remoteVersion: updateDiff.updated[i].remoteVersion };
		}
		for(let i=0;i<updateDiff.removed.length;i++){
			statusIndex[updateDiff.removed[i].id] = { kind:'removed' };
		}
		for(let i=0;i<(updateDiff.unknown||[]).length;i++){
			statusIndex[updateDiff.unknown[i].id] = { kind:'unknown' };
		}
		for(let i=0;i<updateDiff.added.length;i++){
			// Added plugins are not yet installed — we insert synthetic nodes
			statusIndex[updateDiff.added[i].id] = { kind:'added', remoteVersion: updateDiff.added[i].remoteVersion, siteId: updateDiff.added[i].siteId };
		}
	}

	// Build root data items for installed plugins
	// Each item passed to addRootData has the shape: { plugin, status, deps[] }
	// where deps[] = [{ plugin: depDescriptor, status:{kind:'dep'} }]
	let roots = [];
	for(let i=0;i<installedPlugins.length;i++){
		let p = installedPlugins[i];
		let status = statusIndex[p.id] ? statusIndex[p.id] : { kind:'ok' };
		let deps = [];
		for(let j=0;j<p.requires.length;j++){
			deps.push({ "plugin": p.requires[j], "status": { kind:'dep' }, "deps": [] });
		}
		roots.push({ "plugin": p, "status": status, "deps": deps });
	}

	// Append synthetic items for 'added' plugins (not yet installed)
	if(updateDiff){
		for(let i=0;i<updateDiff.added.length;i++){
			let a = updateDiff.added[i];
			roots.push({ "plugin": { id: a.id, version: a.remoteVersion, name: a.id, siteId: a.siteId, requires:[] }, "status": { kind:'added', remoteVersion: a.remoteVersion }, "deps": [] });
		}
	}

	// Sort alphabetically by plugin id
	roots.sort(function(a,b){ return a.plugin.id.localeCompare(b.plugin.id); });

	// Build and render the tree
	if(!treeViewer){
		treeViewer = new TreeViewer('updaterTree', document.getElementById('updTreeArea'));
		treeViewer.init();
		treeViewer.setVisitor(pluginVisitor);
		treeViewer.setDecorator(pluginDecorator);
		treeViewer.setEventListener(pluginEventListener);
	}
	treeViewer.clear();
	for(let i=0;i<roots.length;i++){
		treeViewer.addRootData(roots[i]);
	}
	treeViewer.refreshTree();
}

/* ===== Tree visitor, decorator, event listener ===== */

var pluginVisitor = {
	getLabel: function(element){
		return element.plugin.id;
	},
	getChildren: function(element){
		return element.deps || [];
	},
	isParent: function(element){
		return element.deps && element.deps.length > 0;
	}
};

var pluginDecorator = {
	decorate: function(element, label){
		let plugin = element.plugin;
		let status = element.status;
		let cssClass = '';
		let badge = '';

		if('dep'==status.kind){
			// Dependency sub-node
			return '<img src="/uiTools/img/silk/arrow_right.png">&nbsp;<small style="color:#888;">'
				+ plugin.id + ' <i>v' + plugin.version + '</i></small>';
		}

		if('updated'==status.kind){
			cssClass = 'upd-node-updated';
			badge = '<span class="upd-badge-updated">'
				+ npaUi.getLocalizedString('@apaf.updater.badge.updated')
				+ ' &rarr; v' + status.remoteVersion + '</span>';
		} else if('added'==status.kind){
			cssClass = 'upd-node-added';
			badge = '<span class="upd-badge-added">'
				+ npaUi.getLocalizedString('@apaf.updater.badge.new') + '</span>';
		} else if('removed'==status.kind){
			cssClass = 'upd-node-removed';
			badge = '<span class="upd-badge-removed">'
				+ npaUi.getLocalizedString('@apaf.updater.badge.removed') + '</span>';
		} else if('unknown'==status.kind){
			badge = '<span class="upd-badge-unknown">'
				+ npaUi.getLocalizedString('@apaf.updater.badge.unknown') + '</span>';
		}

		let hasDeps = element.deps && element.deps.length > 0;
		let nodeIcon = hasDeps ? '/uiTools/img/silk/bricks.png' : '/uiTools/img/silk/plugin.png';

		return '<span class="' + cssClass + '">'
			+ '<img src="' + nodeIcon + '">&nbsp;'
			+ plugin.id
			+ ' <small><i>v' + plugin.version + '</i></small>'
			+ badge
			+ '</span>';
	}
};

var pluginEventListener = {
	onNodeSelected: function(node){
		showPluginDetail(node.data);
	}
};

/* ===== Right panel ===== */

showPanel = function(which){
	$('#updHint').hide();
	$('#updDetailPanel').hide();
	if(which=='hint')   $('#updHint').show();
	if(which=='detail') $('#updDetailPanel').show();
}

showPluginDetail = function(nodeData){
	let plugin = nodeData.plugin;
	let status = nodeData.status;

	if('dep'==status.kind){
		// Click on a dep sub-node — show the dep plugin detail if installed
		let depPlugin = null;
		for(let i=0;i<installedPlugins.length;i++){
			if(installedPlugins[i].id==plugin.id){ depPlugin=installedPlugins[i]; break; }
		}
		if(depPlugin){ plugin = depPlugin; status = { kind:'ok' }; }
		else {
			showPanel('hint');
			return;
		}
	}

	// Title
	let titleHtml = plugin.name || plugin.id;
	if('updated'==status.kind){
		titleHtml += ' <span class="upd-badge-updated">'
			+ npaUi.getLocalizedString('@apaf.updater.badge.updated')
			+ ' &rarr; v' + status.remoteVersion + '</span>';
	} else if('added'==status.kind){
		titleHtml += ' <span class="upd-badge-added">'
			+ npaUi.getLocalizedString('@apaf.updater.badge.new') + '</span>';
	} else if('removed'==status.kind){
		titleHtml += ' <span class="upd-badge-removed">'
			+ npaUi.getLocalizedString('@apaf.updater.badge.removed') + '</span>';
	} else if('unknown'==status.kind){
		titleHtml += ' <span class="upd-badge-unknown">'
			+ npaUi.getLocalizedString('@apaf.updater.badge.unknown') + '</span>';
	}
	$('#updDetailTitle').html(titleHtml);

	// Meta
	let metaHtml = '<span><b>id:</b> ' + plugin.id + '</span>'
		+ '<span><b>' + npaUi.getLocalizedString('@apaf.updater.detail.version') + ':</b> v' + plugin.version + '</span>';
	if(plugin.siteId){
		metaHtml += '<span><b>site:</b> ' + plugin.siteId + '</span>';
	}
	if('updated'==status.kind){
		metaHtml += '<span><b>' + npaUi.getLocalizedString('@apaf.updater.detail.available') + ':</b> v' + status.remoteVersion + '</span>';
	}
	$('#updDetailMeta').html(metaHtml);

	// Action button (Update / Install)
	if('updated'==status.kind || 'added'==status.kind){
		let btnLabel = ('updated'==status.kind)
			? npaUi.getLocalizedString('@apaf.updater.btn.update', [status.remoteVersion])
			: npaUi.getLocalizedString('@apaf.updater.btn.install', [status.remoteVersion]);
		$('#updActionBtn').html('<img src="/uiTools/img/silk/arrow_down.png">&nbsp;' + btnLabel);
		$('#updActionBtn').prop('disabled', false);
		$('#updActionBtn').off('click').on('click', function(){
			requestPluginUpdate(plugin, status);
		});
		$('#updDetailActions').show();
	} else {
		$('#updDetailActions').hide();
	}

	// Dependencies
	if(plugin.requires && plugin.requires.length>0){
		let depsHtml = '';
		for(let i=0;i<plugin.requires.length;i++){
			let dep = plugin.requires[i];
			depsHtml += '<div class="upd-dep-row"><img src="/uiTools/img/silk/arrow_right.png">&nbsp;'
				+ dep.id + ' <i>v' + dep.version + '</i></div>';
		}
		$('#updDetailDepsList').html(depsHtml);
		$('#updDetailDeps').show();
	} else {
		$('#updDetailDeps').hide();
	}

	showPanel('detail');
}

/* ===== Check for updates ===== */

checkForUpdates = function(){
	setStatus(npaUi.getLocalizedString('@apaf.updater.checking'));
	let toolbar = $apaf(TOOLBAR_ID);
	if(toolbar) toolbar.setEnabled(CHECK_FOR_UPDATES_ACTION_ID, false);

	apaf.call({
		"method": "GET",
		"uri": "/apaf-updater/check",
		"payload": {}
	}).then(function(data){
		updateDiff = data;
		let total = (updateDiff.added||[]).length + (updateDiff.updated||[]).length + (updateDiff.removed||[]).length + (updateDiff.unknown||[]).length;
		if(total==0){
			setStatus(npaUi.getLocalizedString('@apaf.updater.check.no.updates'));
		}else{
			setStatus(npaUi.getLocalizedString('@apaf.updater.check.found',[
				(updateDiff.updated||[]).length,
				(updateDiff.added||[]).length,
				(updateDiff.removed||[]).length,
				(updateDiff.unknown||[]).length
			]));
		}
		buildTree();
		if(toolbar) toolbar.setEnabled(CHECK_FOR_UPDATES_ACTION_ID, true);
	}).onError(function(msg){
		if(toolbar) toolbar.setEnabled(CHECK_FOR_UPDATES_ACTION_ID, true);
		showError(npaUi.getLocalizedString('@apaf.updater.check.error',[msg]));
	});
}

/* ===== Request Update & Dependency Resolution ===== */

requestPluginUpdate = function(plugin, status){
	$('#updActionBtn').prop('disabled', true).html(npaUi.getLocalizedString('@apaf.updater.btn.resolving'));
	setStatus(npaUi.getLocalizedString('@apaf.updater.btn.resolving'));

	let targetPlugin = {
		"id": plugin.id,
		"version": status.remoteVersion,
		"siteId": plugin.siteId
	};

	apaf.call({
		"method": "POST",
		"uri": "/apaf-updater/resolve",
		"payload": {
			"plugins": [targetPlugin]
		}
	}).then(function(resolutionResult){
		$('#updActionBtn').prop('disabled', false);
		setStatus('');
		showConfirmationDialog(resolutionResult);
	}).onError(function(msg){
		$('#updActionBtn').prop('disabled', false);
		setStatus('');
		showError(msg);
	});
}

/* ===== Confirmation / Missing Dependencies Dialog ===== */

showConfirmationDialog = function(resolutionResult){
	let modalEl = document.getElementById('updConfirmModal');
	let modal = bootstrap.Modal.getOrCreateInstance(modalEl);

	if(!resolutionResult.canInstall){
		$('#updConfirmModalTitle').html('<span class="text-danger"><img src="/uiTools/img/silk/error.png">&nbsp;' + npaUi.getLocalizedString('@apaf.updater.dialog.missing.title') + '</span>');
		$('#updConfirmModalMsg').html(npaUi.getLocalizedString('@apaf.updater.dialog.missing.msg'));

		let html = '<table class="table table-sm table-striped"><thead><tr><th>Plugin</th><th>Version requise</th><th>Détails</th></tr></thead><tbody>';
		for(let i=0;i<resolutionResult.missingDependencies.length;i++){
			let m = resolutionResult.missingDependencies[i];
			html += '<tr><td><b>' + m.id + '</b></td><td>v' + (m.requiredVersion||'-') + '</td><td class="text-danger">' + (m.error||'') + '</td></tr>';
		}
		html += '</tbody></table>';
		$('#updConfirmModalList').html(html);

		$('#updConfirmModalCancelBtn').html(npaUi.getLocalizedString('@apaf.updater.dialog.confirm.btn.cancel'));
		$('#updConfirmModalProceedBtn').hide();
		modal.show();
		return;
	}

	// Can install
	$('#updConfirmModalTitle').html('<img src="/uiTools/img/silk/arrow_down.png">&nbsp;' + npaUi.getLocalizedString('@apaf.updater.dialog.confirm.title'));
	$('#updConfirmModalMsg').html(npaUi.getLocalizedString('@apaf.updater.dialog.confirm.msg'));

	let toInstall = resolutionResult.toInstall || [];
	let html = '<table class="table table-sm table-striped"><thead><tr><th>Action</th><th>Plugin</th><th>Version cible</th><th>Site</th><th>Version actuelle</th></tr></thead><tbody>';
	for(let i=0;i<toInstall.length;i++){
		let item = toInstall[i];
		let actionBadge = ('update' === item.action)
			? '<span class="badge bg-warning text-dark">Update</span>'
			: '<span class="badge bg-success">Install</span>';
		let curVer = item.currentVersion ? ('v' + item.currentVersion) : '-';
		html += '<tr>'
			+ '<td>' + actionBadge + '</td>'
			+ '<td><b>' + item.id + '</b></td>'
			+ '<td>v' + item.version + '</td>'
			+ '<td>' + (item.siteId||'default') + '</td>'
			+ '<td>' + curVer + '</td>'
			+ '</tr>';
	}
	html += '</tbody></table>';
	$('#updConfirmModalList').html(html);

	$('#updConfirmModalCancelBtn').html(npaUi.getLocalizedString('@apaf.updater.dialog.confirm.btn.cancel'));
	$('#updConfirmModalProceedBtn').html(npaUi.getLocalizedString('@apaf.updater.dialog.confirm.btn.proceed')).show();
	$('#updConfirmModalProceedBtn').off('click').on('click', function(){
		modal.hide();
		startDownloadJob(toInstall);
	});

	modal.show();
}

/* ===== Launch Download Job & Poll Status ===== */

startDownloadJob = function(toInstallList){
	let reportModalEl = document.getElementById('updReportModal');
	let reportModal = bootstrap.Modal.getOrCreateInstance(reportModalEl);

	$('#updReportModalTitle').html('<img src="/uiTools/img/silk/arrow_down.png">&nbsp;' + npaUi.getLocalizedString('@apaf.updater.dialog.report.title'));
	$('#updProgressBar').css('width', '0%').text('0%').removeClass('bg-success bg-danger').addClass('progress-bar-animated');
	$('#updReportStatusText').html(npaUi.getLocalizedString('@apaf.updater.downloading'));
	$('#updReportDetails').html('');
	$('#updReportModalCloseBtn').prop('disabled', true);
	$('#updReportModalCloseX').prop('disabled', true);

	reportModal.show();

	apaf.call({
		"method": "POST",
		"uri": "/apaf-updater/download",
		"payload": {
			"plugins": toInstallList
		}
	}).then(function(jobData){
		let jobId = jobData.jobId;
		pollJobProgress(jobId, toInstallList);
	}).onError(function(msg){
		$('#updReportStatusText').html('<span class="text-danger">' + msg + '</span>');
		$('#updProgressBar').removeClass('progress-bar-animated').addClass('bg-danger');
		$('#updReportModalCloseBtn').prop('disabled', false);
		$('#updReportModalCloseX').prop('disabled', false);
	});
}

pollJobProgress = function(jobId, toInstallList){
	let interval = setInterval(function(){
		apaf.call({
			"method": "GET",
			"uri": "/apaf-jobs/" + jobId,
			"payload": {}
		}).then(function(job){
			let progress = job.progress || 0;
			$('#updProgressBar').css('width', progress + '%').text(progress + '%');

			let report = job.downloadReport || {};
			let items = report.items || [];
			if(items.length > 0){
				let html = '<table class="table table-sm table-bordered"><thead><tr><th>Plugin</th><th>Statut</th><th>Archive / Taille</th></tr></thead><tbody>';
				for(let i=0;i<items.length;i++){
					let it = items[i];
					let statusCol = (it.status === 'success')
						? '<span class="badge bg-success">OK</span>'
						: '<span class="badge bg-danger">Erreur</span> ' + (it.error||'');
					let sizeText = it.size ? (Math.round(it.size / 1024) + ' KB') : '-';
					let fileText = it.file ? ('<code>' + it.file + '</code> (' + sizeText + ')') : '-';
					html += '<tr><td><b>' + it.id + '</b> v' + it.version + '</td><td>' + statusCol + '</td><td>' + fileText + '</td></tr>';
				}
				html += '</tbody></table>';
				if(report.targetDir){
					html += '<div class="text-muted" style="font-size: 0.8rem;">' + npaUi.getLocalizedString('@apaf.updater.download.tempdir') + ' <code>' + report.targetDir + '</code></div>';
				}
				$('#updReportDetails').html(html);
			}

			if(job.status === 'completed' || job.status === 'setRollbackOnly' || job.status === 'terminated'){
				clearInterval(interval);
				$('#updProgressBar').removeClass('progress-bar-animated');
				$('#updReportModalCloseBtn').prop('disabled', false);
				$('#updReportModalCloseX').prop('disabled', false);

				if(job.status === 'completed'){
					$('#updProgressBar').addClass('bg-success');
					$('#updReportStatusText').html('<span class="text-success font-weight-bold">' + npaUi.getLocalizedString('@apaf.updater.download.completed', [report.downloaded || items.length]) + '</span>');
					// Propose installation of the downloaded plugins
					$('#updReportModalInstallBtn').html('<img src="/uiTools/img/silk/cog.png">&nbsp;' + npaUi.getLocalizedString('@apaf.updater.btn.install.now')).show();
					$('#updReportModalInstallBtn').off('click').on('click', function(){
						$('#updReportModalInstallBtn').hide();
						startInstallJob(toInstallList);
					});
				} else {
					$('#updProgressBar').addClass('bg-danger');
					$('#updReportStatusText').html('<span class="text-danger font-weight-bold">' + npaUi.getLocalizedString('@apaf.updater.download.failed', [report.downloaded || 0, report.failed || 0]) + '</span>');
					$('#updReportModalInstallBtn').hide();
				}
			}
		}).onError(function(msg){
			clearInterval(interval);
			$('#updReportStatusText').html('<span class="text-danger">' + msg + '</span>');
			$('#updProgressBar').removeClass('progress-bar-animated').addClass('bg-danger');
			$('#updReportModalCloseBtn').prop('disabled', false);
			$('#updReportModalCloseX').prop('disabled', false);
		});
	}, 600);
}

/* ===== Launch Install Job & Poll Status ===== */

startInstallJob = function(toInstallList){
	$('#updReportModalTitle').html('<img src="/uiTools/img/silk/cog.png">&nbsp;' + npaUi.getLocalizedString('@apaf.updater.installing'));
	$('#updProgressBar').css('width', '0%').text('0%').removeClass('bg-success bg-danger').addClass('progress-bar-animated');
	$('#updReportStatusText').html(npaUi.getLocalizedString('@apaf.updater.installing'));
	$('#updReportDetails').html('');
	$('#updReportModalCloseBtn').prop('disabled', true);
	$('#updReportModalCloseX').prop('disabled', true);
	$('#updReportModalInstallBtn').hide();

	apaf.call({
		"method": "POST",
		"uri": "/apaf-updater/install",
		"payload": {
			"plugins": toInstallList
		}
	}).then(function(jobData){
		let jobId = jobData.jobId;
		pollInstallProgress(jobId, toInstallList);
	}).onError(function(msg){
		$('#updReportStatusText').html('<span class="text-danger">' + msg + '</span>');
		$('#updProgressBar').removeClass('progress-bar-animated').addClass('bg-danger');
		$('#updReportModalCloseBtn').prop('disabled', false);
		$('#updReportModalCloseX').prop('disabled', false);
	});
}

pollInstallProgress = function(jobId, toInstallList){
	let interval = setInterval(function(){
		apaf.call({
			"method": "GET",
			"uri": "/apaf-jobs/" + jobId,
			"payload": {}
		}).then(function(job){
			let progress = job.progress || 0;
			$('#updProgressBar').css('width', progress + '%').text(progress + '%');

			let report = job.installReport || {};
			let items = report.items || [];
			if(items.length > 0){
				let html = '<table class="table table-sm table-bordered"><thead><tr><th>Plugin</th><th>Statut</th><th>Répertoire d\'installation</th></tr></thead><tbody>';
				for(let i=0;i<items.length;i++){
					let it = items[i];
					let statusCol = (it.status === 'success')
						? '<span class="badge bg-success">Installé</span>'
						: '<span class="badge bg-danger">Erreur</span> ' + (it.error||'');
					let targetCol = it.targetDir ? ('<code>' + it.targetDir + '</code>') : '-';
					html += '<tr><td><b>' + it.id + '</b> v' + it.version + '</td><td>' + statusCol + '</td><td>' + targetCol + '</td></tr>';
				}
				html += '</tbody></table>';
				$('#updReportDetails').html(html);
			}

			if(job.status === 'completed' || job.status === 'setRollbackOnly' || job.status === 'terminated'){
				clearInterval(interval);
				$('#updProgressBar').removeClass('progress-bar-animated');
				$('#updReportModalCloseBtn').prop('disabled', false);
				$('#updReportModalCloseX').prop('disabled', false);

				if(job.status === 'completed'){
					$('#updProgressBar').addClass('bg-success');
					$('#updReportStatusText').html('<span class="text-success font-weight-bold">' + npaUi.getLocalizedString('@apaf.updater.install.completed', [report.installed || items.length]) + '</span>');
					// Prompt for restart
					setTimeout(function(){
						showRestartDialog();
					}, 1200);
				} else {
					$('#updProgressBar').addClass('bg-danger');
					$('#updReportStatusText').html('<span class="text-danger font-weight-bold">' + npaUi.getLocalizedString('@apaf.updater.install.failed', [report.installed || 0, report.failed || 0]) + '</span>');
				}
			}
		}).onError(function(msg){
			clearInterval(interval);
			$('#updReportStatusText').html('<span class="text-danger">' + msg + '</span>');
			$('#updProgressBar').removeClass('progress-bar-animated').addClass('bg-danger');
			$('#updReportModalCloseBtn').prop('disabled', false);
			$('#updReportModalCloseX').prop('disabled', false);
		});
	}, 600);
}

/* ===== Server Restart Dialog & Trigger ===== */

showRestartDialog = function(){
	let modalEl = document.getElementById('updRestartModal');
	let modal = bootstrap.Modal.getOrCreateInstance(modalEl);

	$('#updRestartModalTitle').html('<img src="/uiTools/img/silk/arrow_refresh.png">&nbsp;' + npaUi.getLocalizedString('@apaf.updater.dialog.restart.title'));
	$('#updRestartModalMsg').html(npaUi.getLocalizedString('@apaf.updater.dialog.restart.msg'));
	$('#updRestartModalLaterBtn').html(npaUi.getLocalizedString('@apaf.updater.dialog.restart.btn.later'));
	$('#updRestartModalConfirmBtn').html(npaUi.getLocalizedString('@apaf.updater.dialog.restart.btn.restart'));

	$('#updRestartModalConfirmBtn').off('click').on('click', function(){
		modal.hide();
		triggerServerRestart();
	});

	modal.show();
}

triggerServerRestart = function(){
	setStatus(npaUi.getLocalizedString('@apaf.updater.restarting'));
	apaf.call({
		"method": "POST",
		"uri": "/apaf-updater/restart",
		"payload": {}
	}).then(function(){
		// After triggering restart, reload page after a short delay
		setTimeout(function(){
			location.reload();
		}, 3000);
	}).onError(function(msg){
		showError(msg);
	});
}

/* ===== Rollback Dialog & Execution ===== */

var currentCheckpoints = [];
var selectedCheckpoint = null;

openRollbackDialog = function(){
	let modalEl = document.getElementById('updRollbackModal');
	let modal = bootstrap.Modal.getOrCreateInstance(modalEl);

	$('#updRollbackModalTitle').html('<img src="/uiTools/img/silk/arrow_undo.png">&nbsp;' + npaUi.getLocalizedString('@apaf.updater.dialog.rollback.title'));
	$('#updRollbackModalIntro').html(npaUi.getLocalizedString('@apaf.updater.dialog.rollback.intro'));
	$('#updRollbackModalCancelBtn').html(npaUi.getLocalizedString('@apaf.updater.dialog.rollback.btn.cancel'));
	$('#updRollbackModalProceedBtn').html(npaUi.getLocalizedString('@apaf.updater.dialog.rollback.btn.revert')).hide().prop('disabled', true);
	$('#updRollbackDetailArea').html('').hide();
	$('#updRollbackListArea').html('<div class="text-muted"><img src="/uiTools/img/silk/hourglass.png">&nbsp;' + npaUi.getLocalizedString('@apaf.updater.loading') + '</div>');

	modal.show();

	apaf.call({
		"method": "GET",
		"uri": "/apaf-updater/checkpoints",
		"payload": {}
	}).then(function(checkpoints){
		currentCheckpoints = checkpoints || [];
		renderCheckpointsList();
	}).onError(function(msg){
		$('#updRollbackListArea').html('<div class="text-danger">' + msg + '</div>');
	});
}

renderCheckpointsList = function(){
	if(currentCheckpoints.length === 0){
		$('#updRollbackListArea').html('<div class="alert alert-info">' + npaUi.getLocalizedString('@apaf.updater.dialog.rollback.empty') + '</div>');
		return;
	}

	let html = '<div class="list-group">';
	for(let i=0;i<currentCheckpoints.length;i++){
		let cp = currentCheckpoints[i];
		let totalPlugins = 0;
		for(let j=0;j<cp.sites.length;j++){
			totalPlugins += (cp.sites[j].plugins || []).length;
		}
		let dateLabel = cp.date ? new Date(cp.date).toLocaleString() : cp.timestamp;
		let isLatest = (i === 0);
		let badge = isLatest
			? '<span class="badge bg-success ms-2">' + npaUi.getLocalizedString('@apaf.updater.dialog.rollback.badge.latest') + '</span>'
			: '<span class="badge bg-secondary ms-2">' + npaUi.getLocalizedString('@apaf.updater.dialog.rollback.badge.locked') + '</span>';

		html += '<a href="#" class="list-group-item list-group-item-action upd-checkpoint-item" data-idx="' + i + '">'
			+ '<div class="d-flex w-100 justify-content-between">'
			+ '<h6 class="mb-1"><img src="/uiTools/img/silk/clock.png">&nbsp;' + dateLabel + badge + '</h6>'
			+ '<small class="badge bg-secondary">' + totalPlugins + ' plugin(s)</small>'
			+ '</div>'
			+ '<small class="text-muted">Par : <b>' + cp.installedBy + '</b> | Sites affect&eacute;s : ' + cp.sites.map(function(s){ return s.siteId; }).join(', ') + '</small>'
			+ '</a>';
	}
	html += '</div>';

	$('#updRollbackListArea').html(html);

	$('.upd-checkpoint-item').on('click', function(e){
		e.preventDefault();
		$('.upd-checkpoint-item').removeClass('active');
		$(this).addClass('active');
		let idx = parseInt($(this).data('idx'));
		selectCheckpoint(currentCheckpoints[idx], idx === 0);
	});
}

selectCheckpoint = function(cp, isLatest){
	selectedCheckpoint = cp;
	if(!selectedCheckpoint){
		$('#updRollbackDetailArea').html('').hide();
		$('#updRollbackModalProceedBtn').hide().prop('disabled', true);
		return;
	}

	let html = '';
	if(!isLatest){
		html += '<div class="alert alert-warning py-2 mb-2" style="font-size: 0.85rem;"><img src="/uiTools/img/silk/lock.png">&nbsp;'
			+ npaUi.getLocalizedString('@apaf.updater.dialog.rollback.locked.warning')
			+ '</div>';
	}

	html += '<h6 class="mt-2 mb-2 font-weight-bold">D&eacute;tail des modifications par site&nbsp;:</h6>';
	for(let i=0;i<cp.sites.length;i++){
		let site = cp.sites[i];
		html += '<div class="card mb-2"><div class="card-header py-1 bg-light"><b>Site : ' + site.siteId + '</b> <small class="text-muted">(' + site.siteLocation + ')</small></div>';
		html += '<div class="card-body p-2"><table class="table table-sm table-striped mb-0"><thead><tr><th>Plugin</th><th>Action initiale</th><th>Version install&eacute;e</th><th>Version pr&eacute;c&eacute;dente</th></tr></thead><tbody>';
		let plugins = site.plugins || [];
		for(let j=0;j<plugins.length;j++){
			let p = plugins[j];
			let prev = p.previousVersion ? ('v' + p.previousVersion) : '<span class="text-muted">(nouveau)</span>';
			html += '<tr><td><b>' + p.id + '</b></td><td>' + (p.action||'update') + '</td><td>v' + p.version + '</td><td>' + prev + '</td></tr>';
		}
		html += '</tbody></table></div></div>';
	}

	$('#updRollbackDetailArea').html(html).show();
	$('#updRollbackModalProceedBtn').show().prop('disabled', !isLatest);

	if(isLatest){
		$('#updRollbackModalProceedBtn').off('click').on('click', function(){
			executeRollback(selectedCheckpoint);
		});
	} else {
		$('#updRollbackModalProceedBtn').off('click');
	}
}

executeRollback = function(cp){
	let dateLabel = cp.date ? new Date(cp.date).toLocaleString() : cp.timestamp;
	let rawConfirmMsg = npaUi.getLocalizedString('@apaf.updater.dialog.rollback.confirm', [dateLabel]);
	let confirmMsg = decodeHtmlEntities(rawConfirmMsg);
	if(!confirm(confirmMsg)){
		return;
	}

	$('#updRollbackModalProceedBtn').prop('disabled', true);
	$('#updRollbackModalCancelBtn').prop('disabled', true);

	apaf.call({
		"method": "POST",
		"uri": "/apaf-updater/rollback",
		"payload": {
			"timestamp": cp.timestamp
		}
	}).then(function(report){
		let modalEl = document.getElementById('updRollbackModal');
		let modal = bootstrap.Modal.getInstance(modalEl);
		if(modal) modal.hide();

		let count = (report.revertedPlugins || []).length;
		flash(npaUi.getLocalizedString('@apaf.updater.dialog.rollback.success', [count]));

		// Propose server restart
		setTimeout(function(){
			showRestartDialog();
		}, 1000);
	}).onError(function(msg){
		$('#updRollbackModalProceedBtn').prop('disabled', false);
		$('#updRollbackModalCancelBtn').prop('disabled', false);
		showError(msg);
	});
}
