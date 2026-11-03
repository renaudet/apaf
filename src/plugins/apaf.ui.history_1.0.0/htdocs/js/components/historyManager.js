/*
 * historyManager.js - HistoryManager data component for apaf.ui.history
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 *
 * Namespace : apafHistory
 * Component : HistoryManager
 * Version   : 1.0.0
 *
 * A pure data component (no rendering). Wraps the two apaf.ui.history REST endpoints.
 * Usage pattern mirrors npaUiCore.DataManager.
 *
 * JSON configuration:
 * {
 *   "id":      "myHistoryManager",
 *   "type":    "apafHistory.HistoryManager",
 *   "version": "1.0.0",
 *   "configuration": {
 *     "context": "ssh.terminal",   // REQUIRED – named history context
 *     "maxSize": 10                // optional – max entries to keep (default 10)
 *   }
 * }
 *
 * Public API (after npaUi.render()):
 *   let mgr = npaUi.getComponent('myHistoryManager');
 *
 *   mgr.load(function(entries){ ... }, function(msg){ ... });
 *
 *   mgr.save(entry, sensitiveFields, function(entries){ ... }, function(msg){ ... });
 *      // entry           = plain object { fieldName: value, ... }
 *      // sensitiveFields = array of field names to strip before persisting, e.g. ['password']
 */

var apafHistory = apafHistory || {};

apafHistory.HistoryManager = class HistoryManager extends NpaUiComponent {

	/* No DOM output — this component is invisible. */
	initialize(then){ then(); }
	render(then){ then(); }

	_context(){
		return this.getConfiguration().context || '';
	}
	_maxSize(){
		let s = this.getConfiguration().maxSize;
		return (typeof s === 'number' && s > 0) ? s : 10;
	}

	/*
	 * load(onSuccess, onError)
	 *   onSuccess(entries) — entries = array, most-recent first
	 *   onError(message)   — optional
	 */
	load(onSuccess, onError){
		let ctx = this._context();
		if(!ctx){
			if(onError){ onError('HistoryManager: no context configured'); }
			return;
		}
		makeRESTCall('GET', '/apaf-history/' + encodeURIComponent(ctx), {}, function(response){
			if(response && response.status === 200){
				if(onSuccess){ onSuccess(response.data || []); }
			}else{
				if(onError){ onError(response ? response.message : 'unknown error'); }
			}
		}, function(err){
			if(onError){ onError(err && err.message ? err.message : String(err)); }
		});
	}

	/*
	 * save(entry, sensitiveFields, onSuccess, onError)
	 *   Strips sensitiveFields from entry before sending to the server.
	 *   onSuccess(entries) — entries = updated array after save
	 *   onError(message)   — optional
	 */
	save(entry, sensitiveFields, onSuccess, onError){
		let ctx     = this._context();
		let maxSize = this._maxSize();
		if(!ctx){
			if(onError){ onError('HistoryManager: no context configured'); }
			return;
		}
		// Strip sensitive fields
		let safe      = {};
		let sensitive = sensitiveFields || [];
		for(let k in entry){
			if(sensitive.indexOf(k) === -1){ safe[k] = entry[k]; }
		}
		makeRESTCall('POST', '/apaf-history/' + encodeURIComponent(ctx),
		             { entry: safe, maxSize: maxSize },
		             function(response){
		             	if(response && response.status === 200){
		             		let entries = (response.data && response.data.entries)
		             		              ? response.data.entries : [];
		             		if(onSuccess){ onSuccess(entries); }
		             	}else{
		             		if(onError){ onError(response ? response.message : 'unknown error'); }
		             	}
		             },
		             function(err){
		             	if(onError){ onError(err && err.message ? err.message : String(err)); }
		             });
	}
};
