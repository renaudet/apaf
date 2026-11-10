/*
 * historyInput.js - HistoryInput UI component for APAF
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 *
 * Namespace : apafHistory
 * Component : HistoryInput
 * Version   : 1.0.0
 *
 * Configuration schema (config.configuration):
 * {
 *   "context":    "<string>",          // REQUIRED – named history context (e.g. "ssh.terminal")
 *   "fields":     [                    // REQUIRED – field descriptors
 *     {
 *       "name":      "<fieldName>",    // logical name, used as form field id + history key
 *       "label":     "<label|@i18nKey>",
 *       "type":      "text|password|number",  // default "text"
 *       "sensitive": true|false,       // if true, field is NEVER stored in history (default false)
 *       "placeholder": "<string|@i18nKey>"    // optional
 *     }
 *   ],
 *   "maxSize":    10,                  // max history entries to keep (default 10)
 *   "submitLabel":"@key|text",         // label for the submit button (optional)
 *   "submitIcon": "/path/to/icon.png", // icon for the submit button (optional)
 *   "onSubmit":   "<functionName>"     // global JS function called with the form values object
 * }
 *
 * Public API (available as npaUi.getComponent('<id>')):
 *   component.getValues()           → { fieldName: value, ... } current form values
 *   component.setValues(obj)        → fills form fields from obj
 *   component.loadHistory()         → (re)loads history from server
 *   component.saveHistory(values)   → pushes values to server (strips sensitive fields)
 *
 * Usage example (from a APAF snippet / fragment):
 *   let histComp = $apaf('mySshHistory');
 *   histComp.onSubmit = function(values) {
 *       // values.host, values.port, values.username are set
 *       // values.password is present (it was filled by the user) but was NOT stored
 *   };
 */

// Declare the namespace if it doesn't exist yet (e.g. when this is the first component loaded
// in this namespace).  Other components in the apafHistory namespace can do the same safely.
var apafHistory = apafHistory || {};

apafHistory.HistoryInput = class HistoryInput extends NpaUiComponent {

	/*
	 * initialize() – loads the component stylesheet once.
	 */
	initialize(then){
		$.loadCss('/apaf-ui-history/css/historyInput.css', then);
	}

	/*
	 * render() – builds the DOM the first time, then re-renders history dropdown only.
	 */
	render(then){
		let config = this.getConfiguration();
		if(!config.fields || config.fields.length === 0){
			this.parentDiv().html('<div class="apaf-history-error">HistoryInput: no fields configured</div>');
			then();
			return;
		}
		if(this.parentDiv().data('loaded') !== 'true'){
			this._buildDom(config);
			this.parentDiv().data('loaded', 'true');
			this.loadHistory();
		}
		then();
	}

	/*
	 * Build the full DOM for the component.
	 * Layout: for each field → label + input + (history dropdown button for non-sensitive fields).
	 */
	_buildDom(config){
		let self = this;
		let id   = this.getId();
		let html = '<div class="apaf-history-root" id="' + id + '_root">';

		for(let i = 0; i < config.fields.length; i++){
			let f       = config.fields[i];
			let fId     = id + '_field_' + f.name;
			let fType   = f.type || 'text';
			let fLabel  = this.getLocalizedString(f.label || f.name);
			let fPh     = f.placeholder ? this.getLocalizedString(f.placeholder) : '';
			let hasDrop = !f.sensitive;

			html += '<div class="apaf-history-field-row">';
			html += '  <label class="apaf-history-label" for="' + fId + '">' + fLabel + '</label>';
			html += '  <div class="apaf-history-input-wrap' + (hasDrop ? ' has-dropdown' : '') + '">';
			html += '    <input id="' + fId + '" type="' + fType + '" class="apaf-history-input"';
			if(fPh){ html += ' placeholder="' + fPh + '"'; }
			html += ' autocomplete="off">';
			if(hasDrop){
				let tooltip = this.getLocalizedString('@apaf.ui.history.component.tooltip');
				html += '    <button class="apaf-history-drop-btn" data-field="' + f.name + '" title="' + tooltip + '" type="button">';
				html += '      <img src="/uiTools/img/silk/bullet_arrow_down.png" width="16">';
				html += '    </button>';
				html += '    <ul class="apaf-history-dropdown" id="' + id + '_drop_' + f.name + '" style="display:none;"></ul>';
			}
			html += '  </div>';
			html += '</div>';
		}

		// Submit button row
		let submitLabel = config.submitLabel ? this.getLocalizedString(config.submitLabel) : 'OK';
		let submitIcon  = config.submitIcon  || '/uiTools/img/silk/accept.png';
		html += '<div class="apaf-history-actions">';
		html += '  <button id="' + id + '_submit" class="btn btn-sm btn-primary apaf-history-submit" type="button">';
		html += '    <img src="' + submitIcon + '" width="16" style="margin-right:4px;">' + submitLabel;
		html += '  </button>';
		html += '</div>';
		html += '</div>'; // apaf-history-root

		this.parentDiv().html(html);

		// Bind submit button
		$('#' + id + '_submit').on('click', function(){
			self._onSubmitClicked();
		});

		// Bind dropdown toggle buttons
		this.parentDiv().find('.apaf-history-drop-btn').on('click', function(){
			let fieldName = $(this).data('field');
			self._toggleDropdown(fieldName);
		});

		// Close dropdowns when clicking outside
		$(document).on('click.apafHistory_' + id, function(e){
			if(!$(e.target).closest('#' + id + '_root').length){
				self._closeAllDropdowns();
			}
		});
	}

	/*
	 * Toggle the dropdown for a specific field.
	 */
	_toggleDropdown(fieldName){
		let id    = this.getId();
		let ddId  = '#' + id + '_drop_' + fieldName;
		let isVis = $(ddId).is(':visible');
		this._closeAllDropdowns();
		if(!isVis){
			$(ddId).show();
		}
	}

	/*
	 * Close all open dropdowns.
	 */
	_closeAllDropdowns(){
		let id = this.getId();
		$('#' + id + '_root .apaf-history-dropdown').hide();
	}

	/*
	 * Load history entries from the server and populate field dropdowns.
	 */
	loadHistory(){
		let self    = this;
		let config  = this.getConfiguration();
		let context = config.context;
		if(!context){ return; }
		$.ajax({
			url:      '/apaf-history/' + encodeURIComponent(context),
			method:   'GET',
			dataType: 'json',
			success:  function(response){
				if(response && response.status === 200){
					self._history = response.data || [];
					self._populateDropdowns();
				}else{
					let msg = npaUi.getLocalizedString('@apaf.ui.history.component.error.load')
					              .replace('{0}', response ? response.message : 'unknown');
					console.warn('[HistoryInput] ' + msg);
				}
			},
			error: function(xhr, status, err){
				let msg = npaUi.getLocalizedString('@apaf.ui.history.component.error.load')
				              .replace('{0}', err);
				console.warn('[HistoryInput] ' + msg);
			}
		});
	}

	/*
	 * Push the given values object to the server (sensitive fields already excluded).
	 * values: { fieldName: value, ... }
	 */
	saveHistory(values){
		let self    = this;
		let config  = this.getConfiguration();
		let context = config.context;
		if(!context){ return; }
		let safeEntry = this._stripSensitiveFields(values);
		let maxSize   = (typeof config.maxSize === 'number' && config.maxSize > 0) ? config.maxSize : 10;
		$.ajax({
			url:         '/apaf-history/' + encodeURIComponent(context),
			method:      'POST',
			contentType: 'application/json',
			data:        JSON.stringify({"entry": safeEntry, "maxSize": maxSize}),
			dataType:    'json',
			success:     function(response){
				if(response && response.status === 200){
					// Update local cache and refresh dropdowns
					if(response.data && response.data.entries){
						self._history = response.data.entries;
					}else{
						// fallback: prepend manually
						if(!self._history){ self._history = []; }
						let entryJson = JSON.stringify(safeEntry);
						self._history = self._history.filter(function(e){
							return JSON.stringify(e) !== entryJson;
						});
						self._history.unshift(safeEntry);
						if(self._history.length > maxSize){
							self._history = self._history.slice(0, maxSize);
						}
					}
					self._populateDropdowns();
				}else{
					let msg = npaUi.getLocalizedString('@apaf.ui.history.component.error.save')
					              .replace('{0}', response ? response.message : 'unknown');
					console.warn('[HistoryInput] ' + msg);
				}
			},
			error: function(xhr, status, err){
				let msg = npaUi.getLocalizedString('@apaf.ui.history.component.error.save')
				              .replace('{0}', err);
				console.warn('[HistoryInput] ' + msg);
			}
		});
	}

	/*
	 * Return a copy of values with sensitive fields removed.
	 */
	_stripSensitiveFields(values){
		let config  = this.getConfiguration();
		let safe    = {};
		for(let fieldName in values){
			let fieldDef = (config.fields || []).find(function(f){ return f.name === fieldName; });
			if(!fieldDef || !fieldDef.sensitive){
				safe[fieldName] = values[fieldName];
			}
		}
		return safe;
	}

	/*
	 * Populate all non-sensitive field dropdowns from the cached history.
	 */
	_populateDropdowns(){
		let self    = this;
		let config  = this.getConfiguration();
		let id      = this.getId();
		let history = this._history || [];
		let noHistoryLabel = npaUi.getLocalizedString('@apaf.ui.history.component.no.history');

		(config.fields || []).forEach(function(f){
			if(f.sensitive){ return; }
			let ddId = '#' + id + '_drop_' + f.name;
			let $dd  = $(ddId);
			$dd.empty();
			if(history.length === 0){
				$dd.append('<li class="apaf-history-item apaf-history-empty">' + noHistoryLabel + '</li>');
				return;
			}
			let seen = [];
			history.forEach(function(entry){
				let val = entry[f.name];
				if(typeof val === 'undefined' || val === null || val === ''){ return; }
				let strVal = String(val);
				if(seen.indexOf(strVal) !== -1){ return; }
				seen.push(strVal);
				let $li = $('<li class="apaf-history-item"></li>').text(strVal);
				$li.on('click', function(){
					self._applyHistoryEntry(entry);
					self._closeAllDropdowns();
				});
				$dd.append($li);
			});
		});
	}

	/*
	 * Fill all input fields from a history entry object.
	 * Sensitive fields are NOT overwritten from history (they keep their current value
	 * or are left empty since we never store them).
	 */
	_applyHistoryEntry(entry){
		let config = this.getConfiguration();
		let id     = this.getId();
		(config.fields || []).forEach(function(f){
			if(f.sensitive){ return; }
			let fId = id + '_field_' + f.name;
			let val = entry[f.name];
			if(typeof val !== 'undefined' && val !== null){
				$('#' + fId).val(String(val));
			}
		});
	}

	/*
	 * Collect current form values and call the configured onSubmit handler.
	 * The caller is responsible for persisting via saveHistory() after a successful operation.
	 */
	_onSubmitClicked(){
		let values = this.getValues();
		let config = this.getConfiguration();
		if(config.onSubmit && typeof window[config.onSubmit] === 'function'){
			window[config.onSubmit].call(this, values);
		}
		// Also fire a custom DOM event so snippet-based apps can listen
		let event = new CustomEvent('apafHistory:submit', {
			bubbles: true,
			detail: {"component": this, "values": values, "context": config.context}
		});
		this.parentDiv()[0].dispatchEvent(event);
	}

	/*
	 * Public: return an object with all current field values.
	 */
	getValues(){
		let config = this.getConfiguration();
		let id     = this.getId();
		let result = {};
		(config.fields || []).forEach(function(f){
			let fId = id + '_field_' + f.name;
			result[f.name] = $('#' + fId).val() || '';
		});
		return result;
	}

	/*
	 * Public: fill the form fields from the given values object.
	 */
	setValues(obj){
		let config = this.getConfiguration();
		let id     = this.getId();
		(config.fields || []).forEach(function(f){
			if(typeof obj[f.name] !== 'undefined'){
				$('#' + id + '_field_' + f.name).val(obj[f.name]);
			}
		});
	}
}
