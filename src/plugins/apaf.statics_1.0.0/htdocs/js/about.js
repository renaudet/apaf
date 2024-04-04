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
	html += '   <b>'+apaf.localize('@apaf.page.about.card.repository')+'</b>&nbsp;<a href="https://github.com/renaudet/apaf">https://github.com/renaudet/apaf</a><br>';
	html += '</div>';
	html += '<div style="margin-top: 20px;">&nbsp;</div>';
	parent.append(html);
}