/*
 * npmManager.js - APAF NPM Package Manager Client
 * Copyright 2026 Nicolas Renaudet - All rights reserved
 */

const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const CARD_ID = 'npmManagerCard';

var allPackages = [];
var selectedPkgToDelete = null;

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

function initializeUi(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE, function(){
		npaUi.initialize(function(){
			npaUi.render();
			localizeUi();
			loadPackages();
			bindEvents();
		});
	});
}

function setStatus(statusText){
	let card = $apaf(CARD_ID);
	if(card && typeof card.setStatus === 'function'){
		card.setStatus(statusText);
	}
}

function notify(type, msg){
	let notifier = $apaf('notifier');
	if(notifier){
		if(type === 'success') notifier.notifySuccess(msg);
		else if(type === 'error') notifier.notifyError(msg);
		else notifier.notifyInfo(msg);
	} else {
		console.log('[' + type.toUpperCase() + '] ' + msg);
	}
}

function localizeUi(){
	$('#lblBtnAdd').html(npaUi.getLocalizedString('@apaf.npm.manager.btn.add'));
	$('#lblBtnReconcile').html(npaUi.getLocalizedString('@apaf.npm.manager.btn.reconcile'));
	$('#lblBtnRefresh').html(npaUi.getLocalizedString('@apaf.npm.manager.btn.refresh'));
	$('#txtFilter').attr('placeholder', $('<div/>').html(npaUi.getLocalizedString('@apaf.npm.manager.search.placeholder')).text());

	$('#thName').html(npaUi.getLocalizedString('@apaf.npm.manager.th.name'));
	$('#thInstalled').html(npaUi.getLocalizedString('@apaf.npm.manager.th.installed'));
	$('#thTarget').html(npaUi.getLocalizedString('@apaf.npm.manager.th.target'));
	$('#thType').html(npaUi.getLocalizedString('@apaf.npm.manager.th.type'));
	$('#thConsumers').html(npaUi.getLocalizedString('@apaf.npm.manager.th.consumers'));
	$('#thActions').html(npaUi.getLocalizedString('@apaf.npm.manager.th.actions'));

	$('#lblModalAddTitle').html(npaUi.getLocalizedString('@apaf.npm.manager.modal.add.title'));
	$('#lblModalAddName').html(npaUi.getLocalizedString('@apaf.npm.manager.modal.add.name'));
	$('#lblModalAddVersion').html(npaUi.getLocalizedString('@apaf.npm.manager.modal.add.version'));
	$('#btnModalAddCancel').html(npaUi.getLocalizedString('@apaf.npm.manager.modal.add.btn.cancel'));
	$('#btnModalAddSubmit').html(npaUi.getLocalizedString('@apaf.npm.manager.modal.add.btn.save'));

	$('#lblModalUninstallTitle').html(npaUi.getLocalizedString('@apaf.npm.manager.modal.uninstall.title'));
	$('#btnModalUninstallCancel').html(npaUi.getLocalizedString('@apaf.npm.manager.modal.add.btn.cancel'));
	$('#btnModalUninstallConfirm').html(npaUi.getLocalizedString('@apaf.npm.manager.modal.uninstall.btn.confirm'));

	$('#lblModalOutputTitle').html(npaUi.getLocalizedString('@apaf.npm.manager.modal.reconcile.title'));
	$('#btnModalOutputClose').html(npaUi.getLocalizedString('@apaf.npm.manager.modal.reconcile.btn.close'));
}

function loadPackages(){
	$('#tblPackagesBody').html('<tr><td colspan="6" class="text-center text-muted p-4"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Chargement des d&eacute;pendances NPM...</td></tr>');
	setStatus('Chargement des packages...');
	
	apaf.call({
		method: 'GET',
		uri: '/apaf-npm/packages',
		payload: {}
	}).then(function(data){
		if(data){
			allPackages = data.packages || [];
			updateStats();
			renderPackages(allPackages);
			setStatus(allPackages.length + ' packages configur&eacute;s (' + (data.runtimeDir || '') + ')');
		} else {
			notify('error', 'Erreur lors du chargement des packages');
			setStatus('Erreur de chargement');
		}
	}).onError(function(msg){
		notify('error', 'Erreur : ' + msg);
		setStatus('Erreur : ' + msg);
	});
}

function updateStats(){
	let total = allPackages.length;
	let runtime = allPackages.filter(p => p.type === 'runtime_base').length;
	let plugins = allPackages.filter(p => p.type === 'plugin').length;
	let user = allPackages.filter(p => p.type === 'user').length;

	$('#badgeTotal').html(npaUi.getLocalizedString('@apaf.npm.manager.badge.total', [total]));
	$('#badgeRuntime').html(npaUi.getLocalizedString('@apaf.npm.manager.badge.runtime', [runtime]));
	$('#badgePlugins').html(npaUi.getLocalizedString('@apaf.npm.manager.badge.plugins', [plugins]));
	$('#badgeUser').html(npaUi.getLocalizedString('@apaf.npm.manager.badge.user', [user]));
}

function renderPackages(packages){
	let filter = ($('#txtFilter').val() || '').toLowerCase().trim();
	let filtered = (packages || []).filter(p => {
		if(!filter) return true;
		let nameMatch = p.name && p.name.toLowerCase().includes(filter);
		let typeMatch = p.type && p.type.toLowerCase().includes(filter);
		let consumerMatch = Array.isArray(p.requiredBy) && p.requiredBy.some(c => typeof c === 'string' && c.toLowerCase().includes(filter));
		return nameMatch || typeMatch || consumerMatch;
	});

	if(filtered.length === 0){
		$('#tblPackagesBody').html('<tr><td colspan="6" class="text-center text-muted p-4">Aucun package NPM trouv&eacute;</td></tr>');
		return;
	}

	let html = '';
	for(let pkg of filtered){
		let typeBadge = '';
		if(pkg.type === 'runtime_base'){
			typeBadge = '<span class="badge bg-dark">' + npaUi.getLocalizedString('@apaf.npm.manager.type.runtime_base') + '</span>';
		} else if(pkg.type === 'plugin'){
			typeBadge = '<span class="badge bg-info text-dark">' + npaUi.getLocalizedString('@apaf.npm.manager.type.plugin') + '</span>';
		} else if(pkg.type === 'user'){
			typeBadge = '<span class="badge bg-primary">' + npaUi.getLocalizedString('@apaf.npm.manager.type.user') + '</span>';
		} else {
			typeBadge = '<span class="badge bg-secondary">' + npaUi.getLocalizedString('@apaf.npm.manager.type.extra') + '</span>';
		}

		let installedBadge = '';
		if(pkg.installedVersion){
			installedBadge = '<span class="pkg-version text-success"><code>' + pkg.installedVersion + '</code></span>';
		} else {
			installedBadge = '<span class="badge bg-warning text-dark">' + npaUi.getLocalizedString('@apaf.npm.manager.status.missing') + '</span>';
		}

		let targetBadge = '<span class="pkg-version"><code>' + (pkg.targetVersion || '-') + '</code></span>';

		let consumersHtml = '<div class="pkg-consumers">';
		if(pkg.requiredBy && pkg.requiredBy.length > 0){
			for(let req of pkg.requiredBy){
				consumersHtml += '<span>' + req + '</span>';
			}
		} else {
			consumersHtml += '<span>-</span>';
		}
		consumersHtml += '</div>';

		let actionsHtml = '';
		if(pkg.type === 'user'){
			actionsHtml = '<button class="btn btn-sm btn-outline-danger btn-delete-pkg" data-pkg="' + pkg.name + '" title="Supprimer">' +
						  '<img src="/uiTools/img/silk/delete.png" style="vertical-align:-2px;"></button>';
		} else {
			actionsHtml = '<span class="text-muted" style="font-size:0.8rem;">Verrouill&eacute;</span>';
		}

		html += '<tr>' +
				'<td><span class="pkg-name">' + pkg.name + '</span></td>' +
				'<td>' + installedBadge + '</td>' +
				'<td>' + targetBadge + '</td>' +
				'<td>' + typeBadge + '</td>' +
				'<td>' + consumersHtml + '</td>' +
				'<td style="text-align: center;">' + actionsHtml + '</td>' +
				'</tr>';
	}

	$('#tblPackagesBody').html(html);

	$('.btn-delete-pkg').click(function(){
		selectedPkgToDelete = $(this).attr('data-pkg');
		$('#lblModalUninstallMsg').html(npaUi.getLocalizedString('@apaf.npm.manager.modal.uninstall.msg', [selectedPkgToDelete]));
		new bootstrap.Modal('#modalUninstallPackage').show();
	});
}

function bindEvents(){
	$('#btnRefresh').click(function(){
		loadPackages();
	});

	$('#txtFilter').on('input', function(){
		renderPackages(allPackages);
	});

	$('#btnAddPackage').click(function(){
		$('#inpPkgName').val('');
		$('#inpPkgVersion').val('');
		new bootstrap.Modal('#modalAddPackage').show();
	});

	$('#btnModalAddSubmit').click(function(){
		let name = $('#inpPkgName').val().trim();
		let version = $('#inpPkgVersion').val().trim() || 'latest';
		if(!name){
			notify('error', 'Veuillez saisir le nom du package');
			return;
		}

		bootstrap.Modal.getInstance('#modalAddPackage').hide();
		notify('info', npaUi.getLocalizedString('@apaf.npm.manager.status.updating'));
		setStatus('Installation de ' + name + '...');

		apaf.call({
			method: 'POST',
			uri: '/apaf-npm/install',
			payload: { name: name, version: version }
		}).then(function(result){
			notify('success', 'Package ' + name + ' install&eacute; avec succ&egrave;s');
			loadPackages();
			if(result && result.stdout){
				$('#outputContainer').text(result.stdout);
				new bootstrap.Modal('#modalOutput').show();
			}
		}).onError(function(msg){
			notify('error', 'Erreur : ' + msg);
			setStatus('Erreur installation : ' + msg);
		});
	});

	$('#btnModalUninstallConfirm').click(function(){
		if(!selectedPkgToDelete) return;
		let pkgName = selectedPkgToDelete;
		bootstrap.Modal.getInstance('#modalUninstallPackage').hide();
		notify('info', npaUi.getLocalizedString('@apaf.npm.manager.status.updating'));
		setStatus('Suppression de ' + pkgName + '...');

		apaf.call({
			method: 'POST',
			uri: '/apaf-npm/uninstall',
			payload: { name: pkgName }
		}).then(function(result){
			notify('success', 'Package ' + pkgName + ' supprim&eacute;');
			loadPackages();
		}).onError(function(msg){
			notify('error', 'Erreur : ' + msg);
			setStatus('Erreur suppression : ' + msg);
		});
	});

	$('#btnReconcile').click(function(){
		notify('info', npaUi.getLocalizedString('@apaf.npm.manager.status.updating'));
		setStatus('R&eacute;conciliation et npm install en cours...');

		apaf.call({
			method: 'POST',
			uri: '/apaf-npm/reconcile',
			payload: {}
		}).then(function(result){
			notify('success', 'R&eacute;conciliation termin&eacute;e avec succ&egrave;s');
			loadPackages();
			if(result && result.stdout){
				$('#outputContainer').text(result.stdout);
				new bootstrap.Modal('#modalOutput').show();
			}
		}).onError(function(msg){
			notify('error', 'Erreur : ' + msg);
			setStatus('Erreur r&eacute;conciliation : ' + msg);
		});
	});
}
