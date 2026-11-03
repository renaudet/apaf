/*
 * historyRecall.js - HistoryRecall decorator component for apaf.ui.history
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 *
 * Namespace : apafHistory
 * Component : HistoryRecall
 * Version   : 1.0.0
 *
 * A decorator that attaches a dropdown-recall button next to existing HTML inputs.
 * It reads data from a HistoryManager component and lets the user pick a past entry
 * to fill all bound inputs at once.
 *
 * JSON configuration:
 * {
 *   "id":      "sshHistoryRecall",
 *   "type":    "apafHistory.HistoryRecall",
 *   "version": "1.0.0",
 *   "configuration": {
 *     "manager":  "myHistoryManager",  // REQUIRED – id of the HistoryManager component
 *     "bindings": [                    // REQUIRED – which inputs to decorate
 *       { "inputId": "sshHost",     "field": "host"     },
 *       { "inputId": "sshPort",     "field": "port"     },
 *       { "inputId": "sshUsername", "field": "username" }
 *       // password is NOT listed → never shown in the dropdown
 *     ]
 *   }
 * }
 *
 * Behaviour:
 *  - For each binding a small ▼ button is inserted immediately after the target <input>.
 *  - Clicking ▼ opens a dropdown listing the distinct values for that field from the history.
 *  - Clicking an entry fills ALL bound inputs from that history entry (not just the one column).
 *  - A click outside any dropdown closes them all.
 *
 * The host div itself stays invisible (zero-size); all visual elements are injected
 * into the existing form layout.
 */

var apafHistory = apafHistory || {};

apafHistory.HistoryRecall = class HistoryRecall extends NpaUiComponent {

	initialize(then){
		$.loadCss('/apaf-ui-history/css/historyRecall.css', then);
	}

	render(then){
		// This component produces no HTML of its own.
		// On first render: inject the recall buttons next to the bound inputs, then load history.
		if(this.parentDiv().data('loaded') !== 'true'){
			this.parentDiv().data('loaded', 'true');
			this._injectButtons();
			this._loadAndPopulate();
		}
		then();
	}

	/*
	 * Inject a ▼ button and a dropdown <ul> into the input-group that contains each bound input.
	 * The button is added as a sibling inside the existing Bootstrap input-group so the layout
	 * is preserved exactly as if it had been authored that way.
	 */
	_injectButtons(){
		let self     = this;
		let config   = this.getConfiguration();
		let id       = this.getId();
		let bindings = config.bindings || [];
		let tooltip  = npaUi.getLocalizedString('@apaf.ui.history.component.tooltip');

		bindings.forEach(function(b){
			let $input = $('#' + b.inputId);
			if(!$input.length){ return; }

			let ddId = id + '_drop_' + b.field;

			// Build the button as a Bootstrap input-group-text so it blends in naturally
			let $btn = $('<button type="button" class="apaf-recall-btn input-group-text" title="' + tooltip + '">')
				.attr('id', id + '_btn_' + b.field)
				.attr('data-field', b.field)
				.html('<img src="/uiTools/img/silk/bullet_arrow_down.png" width="14">');

			// The dropdown is positioned relative to the input-group container
			let $dd = $('<ul class="apaf-recall-dropdown" style="display:none;">')
				.attr('id', ddId);

			// Insert the button immediately after the input inside the input-group;
			// append the dropdown to the same input-group (position:relative on input-group
			// is already set by Bootstrap).
			let $group = $input.closest('.input-group');
			if($group.length){
				$input.after($btn);
				$group.append($dd);
				// Bootstrap input-group needs this class removed from the input so it
				// doesn't get double-rounded at the right end.
				$input.removeClass('rounded-end');
			}else{
				// Fallback: no input-group found, wrap manually
				$input.wrap('<span class="apaf-recall-wrap"></span>');
				$input.parent().append($btn).append($dd);
			}

			$btn.on('click', function(e){
				e.stopPropagation();
				self._toggleDropdown(b.field);
			});
		});

		// Close all dropdowns when clicking outside
		$(document).off('click.apafRecall_' + id)
		           .on('click.apafRecall_' + id, function(){
		    self._closeAll();
		});
	}

	/*
	 * Load history entries from the manager component and populate all dropdowns.
	 */
	_loadAndPopulate(){
		let self   = this;
		let config = this.getConfiguration();
		let mgr    = npaUi.getComponent(config.manager);
		if(!mgr){
			console.warn('[HistoryRecall] manager component "' + config.manager + '" not found');
			return;
		}
		mgr.load(
			function(entries){
				self._history = entries;
				self._populateDropdowns();
			},
			function(msg){
				console.warn('[HistoryRecall] load error: ' + msg);
			}
		);
	}

	/*
	 * Rebuild all dropdown lists from the current cached history.
	 */
	_populateDropdowns(){
		let self     = this;
		let config   = this.getConfiguration();
		let id       = this.getId();
		let history  = this._history || [];
		let bindings = config.bindings || [];
		let noHistoryLabel = npaUi.getLocalizedString('@apaf.ui.history.component.no.history');

		bindings.forEach(function(b){
			let $dd = $('#' + id + '_drop_' + b.field);
			$dd.empty();
			if(history.length === 0){
				$dd.append('<li class="apaf-recall-item apaf-recall-empty">' + noHistoryLabel + '</li>');
				return;
			}
			let seen = [];
			history.forEach(function(entry){
				let val = entry[b.field];
				if(typeof val === 'undefined' || val === null || val === ''){ return; }
				let strVal = String(val);
				if(seen.indexOf(strVal) !== -1){ return; }
				seen.push(strVal);
				let $li = $('<li class="apaf-recall-item"></li>').text(strVal);
				$li.on('click', function(){
					self._applyEntry(entry);
					self._closeAll();
				});
				$dd.append($li);
			});
		});
	}

	/*
	 * Fill all bound inputs from a history entry.
	 */
	_applyEntry(entry){
		let config   = this.getConfiguration();
		let bindings = config.bindings || [];
		bindings.forEach(function(b){
			let val = entry[b.field];
			if(typeof val !== 'undefined' && val !== null){
				$('#' + b.inputId).val(String(val));
			}
		});
	}

	/*
	 * Toggle a single field's dropdown open/closed.
	 */
	_toggleDropdown(field){
		let id    = this.getId();
		let ddSel = '#' + id + '_drop_' + field;
		let isVis = $(ddSel).is(':visible');
		this._closeAll();
		if(!isVis){ $(ddSel).show(); }
	}

	/*
	 * Close all recall dropdowns for this component instance.
	 */
	_closeAll(){
		let id = this.getId();
		$('[id^="' + id + '_drop_"]').hide();
	}

	/*
	 * Public: refresh dropdowns from an updated entries array.
	 * Call this after a successful save() to keep dropdowns in sync without a full reload.
	 */
	refresh(entries){
		this._history = entries || [];
		this._populateDropdowns();
	}
};
