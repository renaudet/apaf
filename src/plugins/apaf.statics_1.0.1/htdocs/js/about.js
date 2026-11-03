/*
 * about.js - main javascript resource for the APAF Application About Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';

$(document).ready(function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.onComponentLoaded = displayAboutBox;
			npaUi.render();
		});
	});
});

displayAboutBox = function(){
	var html = '';
	html += '<div class="row" style="">';
	html += '  <div class="col-1">&nbsp;</div>';
	html += '  <div class="col-10">';
	html += '    <div class="card" style="margin-top: 10px;">';
	html += '      <div id="aboutHeader" class="card-header" style="padding-top: 5px;padding-bottom: 5px;">'+apaf.localize('@apaf.page.about.card.title')+'</div>';
	html += '      <ul class="list-group list-group-flush">';
	html += '        <li id="aboutAreaContent" class="list-group-item">&nbsp;</li>';
	html += '      </ul>';
	html += '    </div>';
	html += '  </div>';
	html += '  <div class="col-1">&nbsp;</div>';
	html += '</div>';
	$('#aboutArea').append(html);
	displayCopyrightInfo($('#aboutAreaContent'));
	displayActiveConfiguration();
}

/*
 * Shows the active APAF configuration (public endpoint of apaf.updater >= 1.2.0).
 * Nothing is displayed when the updater plugin is not available or the call fails.
 */
displayActiveConfiguration = function(){
	apaf.call({
		"method": "GET",
		"uri": "/apaf-updater/configuration/current",
		"payload": {}
	}).then(function(data){
		var value = '<span style="font-style: italic;color: gray;">'+apaf.localize('@apaf.page.about.card.configuration.none')+'</span>';
		if(data && data.active){
			value = $('<div>').text((data.active.name||data.active.id)+' v'+data.active.version).html();
		}
		$('#aboutConfiguration').html('<b>'+apaf.localize('@apaf.page.about.card.configuration')+'</b>&nbsp;'+value+'<br>');
	}).onError(function(msg){
		console.log('about: active configuration not available - '+msg);
	});
}

displayCopyrightInfo = function(parent){
	var html = '';
	html += '<div style="">';
	html += '   <img src="/apaf-branding/img/apaf-logo.png" style="display: block;margin-right: auto;margin-left: auto;">';
	html += '</div>';
	html += '<div style="text-align: center;">';
	html += '   <b>'+apaf.localize('@apaf.page.about.card.author')+'</b>&nbsp;Nicolas Renaudet<br>';
	html += '   <b>&copy;Copyright: </b>2024 - Nicolas Renaudet - All Rights Reserved<br>';
	html += '   <b>'+apaf.localize('@apaf.page.about.card.license')+'</b>&nbsp;<span id="licence" style="font-style: italic;color: gray;">MIT</span><br>';
	html += '   <span id="aboutConfiguration"></span>';
	html += '   <b>'+apaf.localize('@apaf.page.about.card.repository')+'</b>&nbsp;<a href="https://github.com/renaudet/apaf">https://github.com/renaudet/apaf</a><br>';
	//html += '   <span id="aboutConfiguration"></span>';
	html += '   <br>';
	html += '   <small><i>APAF is based on the <b>Node-Plugin-Architecture</b> technology.</i></small><br>';
	html += '   <br>';
	html += '   <small>Git repositories:</small><br>';
	html += '   <small><a href="https://github.com/renaudet/Node-Plugin-Architecture">https://github.com/renaudet/Node-Plugin-Architecture</a></small><br>';
	html += '   <small><a href="https://github.com/renaudet/npa-ui-tools">https://github.com/renaudet/npa-ui-tools</a></small><br>';
	html += '   <small><a href="https://github.com/renaudet/apaf">https://github.com/renaudet/apaf</a></small><br>';
	html += '   <small><a href="https://github.com/renaudet/apaf-ext">https://github.com/renaudet/apaf-ext</a></small><br>';
	html += '</div>';
	html += '<div style="margin-top: 20px;">&nbsp;</div>';
	parent.append(html);
}