/*
 * applicationExplorer.js - APAF Application Explorer page controller
 * Copyright 2026 Nicolas Renaudet - All rights reserved
 */

const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';

$(document).ready(function() {
	checkSessionStatus(initializeUi);
});

initializeUi = function() {
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE, function() {
		npaUi.initialize(function() {
			npaUi.onComponentLoaded = function() {
				localizeUi();
				loadApplications();
			};
			npaUi.render();
		});
	});
}

localizeUi = function() {
	$('#appxHintText').html(npaUi.getLocalizedString('apaf.application.explorer.hint'));
}

loadApplications = function() {
	$.get('/apaf-application-explorer-api/applications', function(response) {
		if(response && response.status == 200) {
			let apps = response.data;
			if(apps.length == 0) {
				$('#appxHint').show();
				return;
			}
			renderApplications(apps);
		} else {
			$('#notifier').notifier('notify', 'error', response ? response.message : 'Unknown error');
		}
	});
}

renderApplications = function(apps) {
	let grid = $('#appxGrid');
	grid.empty();
	for(var i = 0; i < apps.length; i++) {
		let app = apps[i];
		let icon = app.menuIcon || '/uiTools/img/silk/application.png';
		let desc = app.description || '';
		let card = $('<div class="appx-tile" role="button" tabindex="0"></div>');
		card.attr('data-uri', app.uri);
		card.html(
			'<div class="appx-tile-icon"><img src="' + icon + '" alt=""></div>' +
			'<div class="appx-tile-name">' + $('<span>').text(app.name).html() + '</div>' +
			'<div class="appx-tile-version">v' + $('<span>').text(app.version).html() + '</div>' +
			'<div class="appx-tile-desc">' + $('<span>').text(desc).html() + '</div>'
		);
		card.on('click', function() {
			window.location.href = $(this).attr('data-uri');
		});
		card.on('keydown', function(e) {
			if(e.key === 'Enter' || e.key === ' ') {
				window.location.href = $(this).attr('data-uri');
			}
		});
		grid.append(card);
	}
}
