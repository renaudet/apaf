/*
 * documentation.js - APAF Documentation page controller
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const GLOBAL_CONFIGURATION_FILE = '/resources/json/globalApafConfig.json';
const CARD_ID = 'documentationCard';
const TOC_URI = '/apaf-documentation-api/toc';

const ICON_CATEGORY    = '/uiTools/img/silk/book.png';
const ICON_SUBCATEGORY = '/uiTools/img/silk/folder_page.png';
const ICON_PAGE        = '/uiTools/img/silk/page_white_text.png';

var docTree = null;

$(document).ready(function() {
	checkSessionStatus(initializeUi);
});

initializeUi = function() {
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE, function() {
		npaUi.initialize(function() {
			npaUi.onComponentLoaded = function() {
				localizeUi();
				loadToc();
			};
			npaUi.render();
		});
	});
}

localizeUi = function() {
	setStatus(npaUi.getLocalizedString('@apaf.documentation.status.loading'));
}

setStatus = function(txt) {
	let card = $apaf(CARD_ID);
	card.setStatus(txt);
}

loadToc = function() {
	makeRESTCall('GET', TOC_URI, {}, function(response) {
		if(response.status == 200) {
			initDocTree(response.data);
			setStatus(npaUi.getLocalizedString('@apaf.documentation.status.ready'));
		} else {
			setStatus(response.message);
		}
	}, function(err) {
		setStatus(err);
	});
}

/* ---- TreeViewer visitor ---- */
var tocVisitor = {
	getLabel: function(el) {
		return el.label;
	},
	getChildren: function(el) {
		if(el.type === 'category')    return el.subcategories;
		if(el.type === 'subcategory') return el.pages;
		return [];
	},
	isParent: function(el) {
		return el.type === 'category' || el.type === 'subcategory';
	}
};

/* ---- TreeViewer decorator ---- */
var tocDecorator = {
	decorate: function(el, label) {
		var icon = ICON_PAGE;
		if(el.type === 'category')    icon = ICON_CATEGORY;
		if(el.type === 'subcategory') icon = ICON_SUBCATEGORY;
		return '<img src="' + icon + '" style="margin-right:4px;vertical-align:middle;">' + label;
	}
};

/* ---- TreeViewer event listener ---- */
var tocEventListener = {
	onNodeSelected: function(node) {
		if(node.data.type === 'page') {
			openPage(node.data.url, node.data.label);
		}
	}
};

initDocTree = function(toc) {
	var domEl = document.getElementById('docTreeArea');
	docTree = new TreeViewer('docTree', domEl);
	docTree.init();
	docTree.setVisitor(tocVisitor);
	docTree.setDecorator(tocDecorator);
	docTree.setEventListener(tocEventListener);

	for(var c = 0; c < toc.length; c++) {
		var cat = toc[c];
		var catNode = { type: 'category', label: cat.category, subcategories: [] };
		for(var s = 0; s < cat.subcategories.length; s++) {
			var subcat = cat.subcategories[s];
			var subcatNode = { type: 'subcategory', label: subcat.label, pages: [] };
			for(var p = 0; p < subcat.pages.length; p++) {
				var page = subcat.pages[p];
				subcatNode.pages.push({ type: 'page', label: page.label, url: page.url });
			}
			catNode.subcategories.push(subcatNode);
		}
		docTree.addRootData(catNode);
	}

	docTree.refreshTree();
	/* Open only the top-level category nodes; subcategories stay collapsed */
	for(var i = 0; i < docTree.rootNode.children.length; i++) {
		docTree.rootNode.children[i].open();
	}
}

openPage = function(url, label) {
	$('#docFrame').attr('src', url);
	setStatus(label);
}
