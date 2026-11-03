/*
 * plugin.js - User Interaction History plugin for APAF
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 *
 * Provides a generic, per-user, per-context interaction history service.
 *
 * CouchDB document structure (one doc per userId × context):
 * {
 *   id:      "<userId>.<context>",      // deterministic CouchDB document id
 *   userId:  "<login>",
 *   context: "<contextName>",
 *   entries: [ <entry>, ... ],          // ordered, most-recent first
 *   maxSize: <number>                   // copied from the push request when first written
 * }
 *
 * REST API
 *   GET  /apaf-history/:context  → { status, message, data: [ <entry>, ... ] }
 *   POST /apaf-history/:context  → { status, message, data: <updated-doc> }
 *       request body: { entry: <object>, maxSize?: <number> }
 *       Fields in the entry that are marked sensitive by the component are
 *       expected to have been stripped by the client BEFORE the call is made.
 */

const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const COUCH_SERVICE_NAME    = 'couchdb';
const HISTORY_DB_REF        = 'apaf_history';
const DEFAULT_MAX_SIZE      = 10;

var plugin = new ApafPlugin();

/*
 * Ensure the apaf_history CouchDB database exists at startup.
 */
plugin.beforeExtensionPlugged = function(){
	this.trace('->beforeExtensionPlugged()');
	let couchService = plugin.getService(COUCH_SERVICE_NAME);
	couchService.checkDatabase(HISTORY_DB_REF, function(err, exists){
		if(err){
			plugin.error('Error checking for CouchDB database ' + HISTORY_DB_REF);
			plugin.error(JSON.stringify(err));
		}else{
			if(exists){
				plugin.info('History database already exists');
			}else{
				plugin.info('History database not found - creating...');
				couchService.createDatabase(HISTORY_DB_REF, function(err, created){
					if(err){
						plugin.error('Error creating CouchDB database ' + HISTORY_DB_REF);
						plugin.error(JSON.stringify(err));
					}else{
						plugin.info('History database created successfully');
					}
				});
			}
		}
		plugin.trace('<-beforeExtensionPlugged()');
	});
}

/*
 * Build the deterministic CouchDB document id for a given user × context pair.
 * Dots and slashes in the context are replaced so the id is safe as a URL segment.
 */
plugin.makeDocId = function(userId, context){
	let safeContext = context.replace(/[^a-zA-Z0-9_\-]/g, '_');
	return userId + '.' + safeContext;
}

/*
 * GET /apaf-history/:context
 * Returns the list of stored history entries for the authenticated user and the
 * given named context.  Responds with an empty array when no history exists yet.
 */
plugin.getHistoryHandler = function(req, res){
	plugin.debug('->getHistoryHandler()');
	res.set('Content-Type', 'application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.ui.history.get.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req, requiredRole, function(err, user){
		if(err){
			plugin.debug('<-getHistoryHandler() - security error: ' + err);
			res.json({"status": 500, "message": err, "data": []});
		}else{
			let context = req.params.context;
			let docId   = plugin.makeDocId(user.login, context);
			let couchService = plugin.getService(COUCH_SERVICE_NAME);
			couchService.findByPrimaryKey(HISTORY_DB_REF, {"id": docId}, function(err, doc){
				if(err){
					plugin.debug('<-getHistoryHandler() - db error');
					res.json({"status": 500, "message": err, "data": []});
				}else{
					let entries = (doc && doc.entries) ? doc.entries : [];
					plugin.debug('<-getHistoryHandler() - ' + entries.length + ' entry(ies)');
					res.json({"status": 200, "message": "ok", "data": entries});
				}
			});
		}
	});
}

/*
 * POST /apaf-history/:context
 * Pushes a new entry into the user's history for the given context.
 *
 * Expected request body:
 *   {
 *     "entry":   { ... }   // the values to store (sensitive fields already stripped)
 *     "maxSize": 10        // optional – maximum number of entries to keep (default 10)
 *   }
 *
 * The entry is prepended to the list (most-recent first).
 * Duplicate entries (same field values) are de-duplicated: an existing identical
 * entry is removed before prepending so that the most-recent position is updated.
 * When the list exceeds maxSize the oldest entries are evicted.
 */
plugin.pushHistoryHandler = function(req, res){
	plugin.debug('->pushHistoryHandler()');
	res.set('Content-Type', 'application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.ui.history.push.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req, requiredRole, function(err, user){
		if(err){
			plugin.debug('<-pushHistoryHandler() - security error: ' + err);
			res.json({"status": 500, "message": err, "data": []});
		}else{
			let body    = req.body || {};
			let entry   = body.entry;
			let maxSize = (typeof body.maxSize === 'number' && body.maxSize > 0)
			              ? body.maxSize
			              : DEFAULT_MAX_SIZE;
			if(typeof entry === 'undefined' || entry === null){
				plugin.debug('<-pushHistoryHandler() - missing entry in request body');
				res.json({"status": 400, "message": "missing 'entry' in request body", "data": []});
				return;
			}
			let context = req.params.context;
			let docId   = plugin.makeDocId(user.login, context);
			let couchService = plugin.getService(COUCH_SERVICE_NAME);
			// Read the existing history document (if any)
			couchService.findByPrimaryKey(HISTORY_DB_REF, {"id": docId}, function(err, doc){
				if(err){
					plugin.debug('<-pushHistoryHandler() - db read error');
					res.json({"status": 500, "message": err, "data": []});
					return;
				}
				let entryJson = JSON.stringify(entry);
				if(doc){
					// Document exists – update it
					let entries = doc.entries || [];
					// De-duplicate: remove any existing entry with identical content
					entries = entries.filter(function(e){
						return JSON.stringify(e) !== entryJson;
					});
					// Prepend the new entry
					entries.unshift(entry);
					// Evict oldest entries beyond maxSize
					if(entries.length > maxSize){
						entries = entries.slice(0, maxSize);
					}
					doc.entries = entries;
					doc.maxSize = maxSize;
					couchService.updateRecord(HISTORY_DB_REF, doc, function(err, updated){
						if(err){
							plugin.debug('<-pushHistoryHandler() - db update error');
							res.json({"status": 500, "message": err, "data": []});
						}else{
							plugin.debug('<-pushHistoryHandler() - updated');
							res.json({"status": 200, "message": "updated", "data": updated});
						}
					});
				}else{
					// Document does not exist – create it
					let newDoc = {
						"id":      docId,
						"userId":  user.login,
						"context": context,
						"entries": [entry],
						"maxSize": maxSize
					};
					couchService.createRecord(HISTORY_DB_REF, newDoc, function(err, created){
						if(err){
							plugin.debug('<-pushHistoryHandler() - db create error');
							res.json({"status": 500, "message": err, "data": []});
						}else{
							plugin.debug('<-pushHistoryHandler() - created');
							res.json({"status": 200, "message": "created", "data": created});
						}
					});
				}
			});
		}
	});
}

module.exports = plugin;
