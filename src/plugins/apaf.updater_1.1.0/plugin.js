/*
 * plugin.js - APAF built-in update manager
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const unzipper = require('unzipper');
const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const JOB_SERVICE_NAME = 'jobs';
const REST_PLUGIN_ID = 'npa.rest';
const STATUS_ONGOING = 'ongoing';
const STATUS_COMPLETED = 'completed';
const STATUS_SETROLLBACKONLY = 'setRollbackOnly';
const CONFIG_MAP_FILE = 'configMap.json';
const CONFIG_FOLDER = 'configurations';
const CONFIG_DESCRIPTOR_FILE = 'configuration.json';
const ACTIVE_CONFIG_FILE = 'activeConfiguration.json';
const DEFAULT_CONFIG_ID = 'apaf';

var plugin = new ApafPlugin();
// descriptors of configurations resolved via /configuration/resolve, keyed by "<id>@<version>"
plugin._resolvedConfigurations = {};

/*
 * GET /apaf-updater/installed
 * Returns the list of all installed plugins with their id, version, siteId
 * and direct plugin dependencies (requires).
 */
plugin.getInstalledPluginsHandler = function(req,res){
	plugin.debug('->getInstalledPluginsHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.updater.installed.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getInstalledPluginsHandler() - error access');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let runtimeMap = plugin.runtime.map;
			let installed = [];
			for(let pluginId in runtimeMap){
				let entry = runtimeMap[pluginId];
				// After createPluginMap() the entry is a PluginWrapper — get the underlying mapEntry
				let pluginConfig = entry.pluginConfig || entry;
				let manifest = pluginConfig.manifest;
				if(!manifest) continue;
				let deps = [];
				if(manifest.requires){
					for(let i=0;i<manifest.requires.length;i++){
						let req = manifest.requires[i];
						if('plugin'==req.type){
							deps.push({"id": req.id,"version": req.version});
						}
					}
				}
				let siteId = (pluginConfig.siteConfig && pluginConfig.siteConfig.id) ? pluginConfig.siteConfig.id : null;
				installed.push({
					"id": manifest.id,
					"version": manifest.version,
					"name": manifest.name||manifest.id,
					"siteId": siteId,
					"requires": deps
				});
			}
			installed.sort(function(a,b){ return a.id.localeCompare(b.id); });
			plugin.debug('<-getInstalledPluginsHandler() - success, '+installed.length+' plugins');
			res.json({"status": 200,"message": "ok","data": installed});
		}
	});
}

/*
 * GET /apaf-updater/check
 * For each site that has an updateSiteUrl, fetches the remote pluginMap.json
 * and compares it with the installed plugins.
 * Returns a diff: { added, updated, removed } lists.
 */
plugin.checkForUpdatesHandler = function(req,res){
	plugin.debug('->checkForUpdatesHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.updater.check.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-checkForUpdatesHandler() - error access');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			// Build installed index: pluginId → { version, siteId }
			let runtimeMap = plugin.runtime.map;
			let installedIndex = {};
			for(let pluginId in runtimeMap){
				let entry = runtimeMap[pluginId];
				let pluginConfig = entry.pluginConfig || entry;
				let manifest = pluginConfig.manifest;
				if(!manifest) continue;
				let siteId = (pluginConfig.siteConfig && pluginConfig.siteConfig.id) ? pluginConfig.siteConfig.id : null;
				installedIndex[manifest.id] = {"version": manifest.version,"siteId": siteId};
			}
			// Collect unique updateSiteUrls per siteId
			let sites = plugin.runtime.config.sites||[];
			let sitesToFetch = [];
			let seenUrls = {};
			for(let i=0;i<sites.length;i++){
				let site = sites[i];
				if(site.updateSiteUrl){
					let baseUrl = plugin._normalizeUpdateSiteBaseUrl(site.updateSiteUrl);
					if(!seenUrls[baseUrl]){
						seenUrls[baseUrl] = true;
						sitesToFetch.push({"site": site, "baseUrl": baseUrl});
					}
				}
			}
			if(sitesToFetch.length==0){
				plugin.debug('<-checkForUpdatesHandler() - no update sites configured');
				res.json({"status": 200,"message": "no.updates","data": {"added":[],"updated":[],"removed":[],"unknown":[]}});
				return;
			}
			// Fetch each updateSite and accumulate the remote plugin catalogue
			// reachableUrls tracks which update baseUrl responded successfully
			let remoteIndex = {};
			let reachableUrls = {};
			let fetchSite = function(idx,done){
				if(idx>=sitesToFetch.length){
					done(null);
					return;
				}
				let item = sitesToFetch[idx];
				let baseUrl = item.baseUrl;
				let catalogUrl = baseUrl + '/pluginMap.json';
				plugin.debug('fetching update site catalog: '+catalogUrl);
				let restPlugin = plugin.runtime.getPlugin(REST_PLUGIN_ID);
				let restContext = plugin._parseUpdateSiteUrl(catalogUrl);
				restContext.method = 'GET';
				restPlugin.performRestApiCall(restContext,function(fetchErr,response){
					if(fetchErr){
						plugin.info('Failed to reach update site '+catalogUrl+': '+fetchErr);
					}else{
						reachableUrls[baseUrl] = true;
						let catalog = response.data;
						if(catalog && Array.isArray(catalog.plugins)){
							for(let j=0;j<catalog.plugins.length;j++){
								let p = catalog.plugins[j];
								if(p.id){
									if(!remoteIndex[p.id] || plugin._compareVersion(p.version,remoteIndex[p.id].version)>0){
										remoteIndex[p.id] = {"version": p.version,"siteId": p.siteId||null,"updateSiteBaseUrl": baseUrl};
									}
								}
							}
						}
					}
					fetchSite(idx+1,done);
				});
			};
			fetchSite(0,function(fetchErr){
				// Compute diff
				let added = [];
				let updated = [];
				let removed = [];
				let unknown = [];
				// Added or updated in remote
				for(let pid in remoteIndex){
					let remote = remoteIndex[pid];
					let local = installedIndex[pid];
					if(!local){
						added.push({"id": pid,"remoteVersion": remote.version,"siteId": remote.siteId});
					}else if(plugin._compareVersion(remote.version,local.version)>0){
						updated.push({"id": pid,"installedVersion": local.version,"remoteVersion": remote.version,"siteId": remote.siteId||local.siteId});
					}
				}
				// Removed or unknown — only for plugins whose site has an updateSiteUrl
				for(let pid in installedIndex){
					let local = installedIndex[pid];
					// Find the updateSite base URL for this plugin's site
					let updateBaseUrl = null;
					for(let i=0;i<sites.length;i++){
						if(sites[i].id==local.siteId && sites[i].updateSiteUrl){
							updateBaseUrl = plugin._normalizeUpdateSiteBaseUrl(sites[i].updateSiteUrl);
							break;
						}
					}
					if(updateBaseUrl && !remoteIndex[pid]){
						if(reachableUrls[updateBaseUrl]){
							// Site responded but plugin is absent → genuinely removed
							removed.push({"id": pid,"installedVersion": local.version,"siteId": local.siteId});
						}else{
							// Site was unreachable → status unknown
							unknown.push({"id": pid,"installedVersion": local.version,"siteId": local.siteId});
						}
					}
				}
				plugin.debug('<-checkForUpdatesHandler() - added:'+added.length+' updated:'+updated.length+' removed:'+removed.length+' unknown:'+unknown.length);
				res.json({"status": 200,"message": "ok","data": {"added": added,"updated": updated,"removed": removed,"unknown": unknown}});
			});
		}
	});
}

/*
 * Normalizes an update site URL to its base directory URL (strips trailing /pluginMap.json or trailing slash).
 */
plugin._normalizeUpdateSiteBaseUrl = function(url){
	if(!url) return '';
	let clean = url.trim().replace(/\/pluginMap\.json$/i, '');
	if(clean.endsWith('/')){
		clean = clean.substring(0, clean.length - 1);
	}
	return clean;
}

/*
 * Returns the base update site URL for a given siteId or the first configured updateSiteUrl.
 */
plugin._getUpdateSiteBaseUrl = function(siteId){
	let sites = plugin.runtime.config.sites || [];
	if(siteId){
		for(let i=0;i<sites.length;i++){
			if(sites[i].id==siteId && sites[i].updateSiteUrl){
				return plugin._normalizeUpdateSiteBaseUrl(sites[i].updateSiteUrl);
			}
		}
	}
	for(let i=0;i<sites.length;i++){
		if(sites[i].updateSiteUrl){
			return plugin._normalizeUpdateSiteBaseUrl(sites[i].updateSiteUrl);
		}
	}
	return null;
}

/*
 * Fetches the manifest.json for a given pluginId and version from its update site.
 */
plugin._fetchRemoteManifest = function(pluginId, version, siteId, callback){
	let baseUrl = plugin._getUpdateSiteBaseUrl(siteId);
	if(!baseUrl){
		callback(new Error('No update site configured for siteId: ' + siteId));
		return;
	}
	let manifestUrl = baseUrl + '/' + pluginId + '_' + version + '/manifest.json';
	plugin.debug('Fetching remote manifest: ' + manifestUrl);
	let restPlugin = plugin.runtime.getPlugin(REST_PLUGIN_ID);
	let restContext = plugin._parseUpdateSiteUrl(manifestUrl);
	restContext.method = 'GET';
	restPlugin.performRestApiCall(restContext, function(err, response){
		if(err){
			callback(err);
		}else{
			callback(null, response.data);
		}
	});
}

/*
 * Fetches the catalog pluginMap.json for a given siteId.
 */
plugin._fetchCatalog = function(siteId, callback){
	let baseUrl = plugin._getUpdateSiteBaseUrl(siteId);
	if(!baseUrl){
		callback(new Error('No update site configured for siteId: ' + siteId));
		return;
	}
	let catalogUrl = baseUrl + '/pluginMap.json';
	plugin.debug('Fetching remote catalog: ' + catalogUrl);
	let restPlugin = plugin.runtime.getPlugin(REST_PLUGIN_ID);
	let restContext = plugin._parseUpdateSiteUrl(catalogUrl);
	restContext.method = 'GET';
	restPlugin.performRestApiCall(restContext, function(err, response){
		if(err){
			callback(err);
		}else{
			let catalog = response.data;
			let map = {};
			if(catalog && Array.isArray(catalog.plugins)){
				for(let i=0;i<catalog.plugins.length;i++){
					let p = catalog.plugins[i];
					if(p.id){
						if(!map[p.id] || plugin._compareVersion(p.version, map[p.id].version) > 0){
							map[p.id] = p;
						}
					}
				}
			}
			callback(null, map);
		}
	});
}

/*
 * Recursively resolves dependencies for a list of target plugins.
 * targetPlugins: [{ id, version, siteId }]
 * pinnedCatalog (optional): { pluginId: { id, version, siteId } } - when provided, it replaces the
 * remote pluginMap.json as the source of versions (used to resolve a global configuration).
 * Returns { canInstall: boolean, toInstall: [...], missingDependencies: [...], errors: [...] }
 */
plugin._resolveDependencies = function(targetPlugins, callback, pinnedCatalog){
	plugin.debug('->_resolveDependencies() ' + JSON.stringify(targetPlugins));
	let runtimeMap = plugin.runtime.map;
	let installedIndex = {};
	for(let pluginId in runtimeMap){
		let entry = runtimeMap[pluginId];
		let pluginConfig = entry.pluginConfig || entry;
		let manifest = pluginConfig.manifest;
		if(!manifest) continue;
		let siteId = (pluginConfig.siteConfig && pluginConfig.siteConfig.id) ? pluginConfig.siteConfig.id : null;
		installedIndex[manifest.id] = { "version": manifest.version, "siteId": siteId };
	}

	let withCatalog = function(cb){
		if(pinnedCatalog){
			cb(null, pinnedCatalog);
		}else{
			plugin._fetchCatalog(null, cb);
		}
	};

	withCatalog(function(catalogErr, catalogMap){
		if(catalogErr){
			callback(catalogErr);
			return;
		}

		let toInstallMap = {}; // pluginId -> { id, version, siteId, currentVersion, action, requires: [] }
		let missingDeps = [];
		let queue = [];
		let visited = {}; // "pluginId@version"

		for(let i=0;i<targetPlugins.length;i++){
			let t = targetPlugins[i];
			let cur = installedIndex[t.id];
			let action = cur ? 'update' : 'install';
			let siteId = t.siteId || (cur ? cur.siteId : (catalogMap[t.id] ? catalogMap[t.id].siteId : 'default'));
			queue.push({
				"id": t.id,
				"version": t.version,
				"siteId": siteId,
				"currentVersion": cur ? cur.version : null,
				"action": action
			});
		}

		let processQueue = function(){
			if(queue.length === 0){
				let toInstall = [];
				for(let pid in toInstallMap){
					toInstall.push(toInstallMap[pid]);
				}
				toInstall.sort(function(a,b){ return a.id.localeCompare(b.id); });
				let canInstall = (missingDeps.length === 0);
				plugin.debug('<-_resolveDependencies() canInstall=' + canInstall + ', toInstall=' + toInstall.length + ', missing=' + missingDeps.length);
				callback(null, {
					"canInstall": canInstall,
					"toInstall": toInstall,
					"missingDependencies": missingDeps
				});
				return;
			}

			let item = queue.shift();
			let key = item.id + '@' + item.version;
			if(visited[key]){
				processQueue();
				return;
			}
			visited[key] = true;
			toInstallMap[item.id] = item;

			// Fetch manifest of this version to inspect its dependencies
			plugin._fetchRemoteManifest(item.id, item.version, item.siteId, function(mErr, manifest){
				if(mErr){
					plugin.info('Could not fetch manifest for ' + key + ': ' + mErr.message);
					missingDeps.push({
						"id": item.id,
						"requiredVersion": item.version,
						"parentPlugin": item.id,
						"error": 'Manifest unreachable for ' + key
					});
					processQueue();
					return;
				}

				let reqs = manifest.requires || [];
				let deps = [];
				for(let j=0;j<reqs.length;j++){
					let r = reqs[j];
					if('plugin' === r.type){
						deps.push(r);
					}
				}
				item.requires = deps.map(function(d){ return { "id": d.id, "version": d.version }; });

				for(let k=0;k<deps.length;k++){
					let dep = deps[k];
					let local = installedIndex[dep.id];
					let candidateInPlan = toInstallMap[dep.id];

					let satisfied = false;
					if(candidateInPlan){
						if(plugin._compareVersion(candidateInPlan.version, dep.version) >= 0){
							satisfied = true;
						}
					}else if(local){
						if(plugin._compareVersion(local.version, dep.version) >= 0){
							satisfied = true;
						}
					}

					if(!satisfied){
						// Must find compatible version in catalog
						let catEntry = catalogMap[dep.id];
						if(!catEntry){
							missingDeps.push({
								"id": dep.id,
								"requiredVersion": dep.version,
								"parentPlugin": item.id,
								"error": 'Dependency ' + dep.id + ' not found in catalog'
							});
						}else if(plugin._compareVersion(catEntry.version, dep.version) < 0){
							missingDeps.push({
								"id": dep.id,
								"requiredVersion": dep.version,
								"catalogVersion": catEntry.version,
								"parentPlugin": item.id,
								"error": 'Catalog version ' + catEntry.version + ' is lower than required ' + dep.version
							});
						}else{
							// Add to queue
							let depSiteId = catEntry.siteId || (local ? local.siteId : 'default');
							queue.push({
								"id": dep.id,
								"version": catEntry.version,
								"siteId": depSiteId,
								"currentVersion": local ? local.version : null,
								"action": local ? 'update' : 'install'
							});
						}
					}
				}

				processQueue();
			});
		};

		processQueue();
	});
}

/*
 * POST /apaf-updater/resolve
 * Body: { "plugins": [{ "id": "pluginId", "version": "1.0.0", "siteId": "apaf" }] }
 * Recursively resolves dependencies for given plugin(s) against catalog and installed plugins.
 */
plugin.resolveDependenciesHandler = function(req,res){
	plugin.debug('->resolveDependenciesHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.updater.resolve.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-resolveDependenciesHandler() - error access');
			res.json({"status": 500,"message": err,"data": null});
		}else{
			let body = req.body || {};
			let targetPlugins = body.plugins || [];
			if(!Array.isArray(targetPlugins) || targetPlugins.length===0){
				res.json({"status": 400,"message": "Missing 'plugins' array in request body","data": null});
				return;
			}
			plugin._resolveDependencies(targetPlugins, function(resErr, resolutionResult){
				if(resErr){
					plugin.error('Error during dependency resolution: ' + resErr.message);
					res.json({"status": 500,"message": resErr.message,"data": null});
				}else{
					plugin.debug('<-resolveDependenciesHandler() - success');
					res.json({"status": 200,"message": "ok","data": resolutionResult});
				}
			});
		}
	});
}

/*
 * Returns the download temporary folder on local filesystem (cross-platform).
 */
plugin._getDownloadsTempDir = function(){
	let tempBase = os.tmpdir();
	let apafUpdatesDir = path.join(tempBase, 'apaf_updates');
	if(!fs.existsSync(apafUpdatesDir)){
		fs.mkdirSync(apafUpdatesDir, { recursive: true });
	}
	return apafUpdatesDir;
}

/*
 * Downloads a single plugin zip file to a temporary directory.
 */
plugin._downloadPluginZip = function(pluginId, version, siteId, destDir, callback){
	let baseUrl = plugin._getUpdateSiteBaseUrl(siteId);
	if(!baseUrl){
		callback(new Error('No update site configured for siteId: ' + siteId));
		return;
	}
	let zipFileName = pluginId + '_' + version + '.zip';
	let zipUrl = baseUrl + '/' + pluginId + '_' + version + '/' + zipFileName;
	let destFilePath = path.join(destDir, zipFileName);

	plugin.debug('Downloading ZIP: ' + zipUrl + ' -> ' + destFilePath);

	axios({
		method: 'get',
		url: zipUrl,
		responseType: 'stream'
	}).then(function(response){
		let writer = fs.createWriteStream(destFilePath);
		response.data.pipe(writer);
		writer.on('finish', function(){
			callback(null, {
				"pluginId": pluginId,
				"version": version,
				"file": destFilePath,
				"fileName": zipFileName,
				"size": fs.statSync(destFilePath).size
			});
		});
		writer.on('error', function(wErr){
			callback(wErr);
		});
	}).catch(function(reqErr){
		callback(reqErr);
	});
}

/*
 * POST /apaf-updater/download
 * Body: { "plugins": [{ "id": "pluginId", "version": "1.0.0", "siteId": "apaf" }] }
 * Creates an asynchronous job via npa.jobs and downloads each zip package into temp directory.
 */
plugin.downloadPluginsHandler = function(req,res){
	plugin.debug('->downloadPluginsHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.updater.download.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-downloadPluginsHandler() - error access');
			res.json({"status": 500,"message": err,"data": null});
		}else{
			let body = req.body || {};
			let targetPlugins = body.plugins || [];
			if(!Array.isArray(targetPlugins) || targetPlugins.length===0){
				res.json({"status": 400,"message": "Missing 'plugins' array in request body","data": null});
				return;
			}

			let jobService = plugin.getService(JOB_SERVICE_NAME);
			let owner = user ? user.login : 'system';
			let jobDesc = 'Download updates for ' + targetPlugins.map(function(p){ return p.id + '@' + p.version; }).join(', ');
			let job = jobService.createJob(owner, jobDesc, true);
			job.status = STATUS_ONGOING;
			job.progress = 0;
			job.downloadReport = {
				"targetDir": plugin._getDownloadsTempDir(),
				"total": targetPlugins.length,
				"downloaded": 0,
				"failed": 0,
				"items": []
			};
			jobService.updateJob(job);

			// Return job immediately to caller
			res.json({"status": 200,"message": "ok","data": { "jobId": job.id, "job": job }});

			// Run download queue asynchronously
			let tempDir = job.downloadReport.targetDir;
			let idx = 0;

			let downloadNext = function(){
				if(idx >= targetPlugins.length){
					job.progress = 100;
					job.status = (job.downloadReport.failed === 0) ? STATUS_COMPLETED : STATUS_SETROLLBACKONLY;
					jobService.updateJob(job);
					plugin.debug('<-downloadPluginsHandler() - background job finished ' + job.id + ' status=' + job.status);
					return;
				}

				let item = targetPlugins[idx];
				plugin._downloadPluginZip(item.id, item.version, item.siteId, tempDir, function(dErr, result){
					if(dErr){
						plugin.error('Failed to download ' + item.id + '_' + item.version + ': ' + dErr.message);
						job.downloadReport.failed++;
						job.downloadReport.items.push({
							"id": item.id,
							"version": item.version,
							"siteId": item.siteId,
							"status": "error",
							"error": dErr.message
						});
					}else{
						job.downloadReport.downloaded++;
						job.downloadReport.items.push({
							"id": item.id,
							"version": item.version,
							"siteId": item.siteId,
							"status": "success",
							"file": result.file,
							"size": result.size
						});
					}
					idx++;
					job.progress = Math.round((idx / targetPlugins.length) * 100);
					jobService.updateJob(job);
					downloadNext();
				});
			};

			// Start asynchronous downloads
			setTimeout(downloadNext, 10);
		}
	});
}

/*
	* Returns the filesystem target location for a given siteId.
	*/
plugin._getSiteLocation = function(siteId){
	let sites = plugin.runtime.config.sites || [];
	if(siteId){
		for(let i=0;i<sites.length;i++){
			if(sites[i].id==siteId){
				return sites[i].location;
			}
		}
	}
	for(let i=0;i<sites.length;i++){
		if(sites[i].id=='default'){
			return sites[i].location;
		}
	}
	return sites.length > 0 ? sites[0].location : './plugins';
}

/*
	* Unzips an archive into a target directory.
	* If the archive contains a single root folder matching <pluginId>_<version>, it extracts into siteLocation.
	* If not, it creates siteLocation/<pluginId>_<version> and extracts inside.
	*/
plugin._extractPluginZip = function(zipFilePath, targetDir, callback){
	plugin.debug('Extracting ZIP: ' + zipFilePath + ' -> ' + targetDir);
	if(!fs.existsSync(targetDir)){
		fs.mkdirSync(targetDir, { recursive: true });
	}

	fs.createReadStream(zipFilePath)
		.pipe(unzipper.Extract({ path: targetDir }))
		.on('close', function(){
			plugin.debug('Extracted successfully: ' + zipFilePath);
			callback(null);
		})
		.on('error', function(err){
			plugin.error('Error extracting ' + zipFilePath + ': ' + err.message);
			callback(err);
		});
}

/*
	* Writes an update manifest log file in each affected site directory for tracking & rollback purposes.
	* File format: site.location/update_<YYYYMMDD_HHmmss>.json
	*/
plugin._writeSiteUpdateManifests = function(installedItems, userLogin, configuration){
	try{
		let now = new Date();
		let pad = function(n){ return (n < 10 ? '0' : '') + n; };
		let timestamp = '' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate()) + '_' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
		let isoDate = now.toISOString();

		// Group installed plugins by siteId
		let siteGroups = {};
		for(let i=0;i<installedItems.length;i++){
			let it = installedItems[i];
			if(it.status === 'success'){
				let sId = it.siteId || 'default';
				if(!siteGroups[sId]){
					siteGroups[sId] = [];
				}
				siteGroups[sId].push(it);
			}
		}

		for(let sId in siteGroups){
			let siteLocation = plugin._getSiteLocation(sId);
			if(fs.existsSync(siteLocation)){
				let manifestFilename = 'update_' + timestamp + '.json';
				let manifestPath = path.join(siteLocation, manifestFilename);
				let manifestContent = {
					"timestamp": timestamp,
					"date": isoDate,
					"installedBy": userLogin || 'system',
					"siteId": sId,
					"siteLocation": siteLocation,
					"configuration": configuration || undefined,
					"plugins": siteGroups[sId].map(function(p){
						return {
							"id": p.id,
							"version": p.version,
							"previousVersion": p.currentVersion || null,
							"action": p.action || (p.currentVersion ? "update" : "install"),
							"targetDir": p.targetDir
						};
					})
				};
				fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, '\t'), 'utf8');
				plugin.info('Update manifest written for site ' + sId + ': ' + manifestPath);
			}
		}
	}catch(err){
		plugin.error('Failed to write site update manifests: ' + err.message);
	}
}

/*
	* Installs a single downloaded plugin zip into its target site.
	*/
plugin._installPlugin = function(item, callback){
	// item: { id, version, siteId, file }
	let siteLocation = plugin._getSiteLocation(item.siteId);
	let zipFile = item.file || path.join(plugin._getDownloadsTempDir(), item.id + '_' + item.version + '.zip');

	if(!fs.existsSync(zipFile)){
		callback(new Error('Downloaded archive not found: ' + zipFile));
		return;
	}

	// We check if the zip contains a top-level directory <pluginId>_<version> or if files are at the root
	fs.createReadStream(zipFile)
		.pipe(unzipper.Parse())
		.on('entry', function (entry) {
			// check first entry path
			entry.autodrain();
		})
		.promise()
		.then(function(){
			// Inspect directory structure: extract to a temporary folder or directly to target
			let targetPluginDir = path.join(siteLocation, item.id + '_' + item.version);
			// Clean old directory with same version if exists
			if(fs.existsSync(targetPluginDir)){
				fs.rmSync(targetPluginDir, { recursive: true, force: true });
			}

			// We extract to siteLocation. If archive already contains folder <pluginId>_<version>, it will place it cleanly.
			// To be robust against archives that do or do not have the root folder:
			let tempExtractDir = path.join(plugin._getDownloadsTempDir(), 'extracted_' + item.id + '_' + item.version);
			if(fs.existsSync(tempExtractDir)){
				fs.rmSync(tempExtractDir, { recursive: true, force: true });
			}
			fs.mkdirSync(tempExtractDir, { recursive: true });

			plugin._extractPluginZip(zipFile, tempExtractDir, function(extErr){
				if(extErr){
					callback(extErr);
					return;
				}

				// Check what's inside tempExtractDir
				let extractedEntries = fs.readdirSync(tempExtractDir, { withFileTypes: true });
				let hasSingleMatchingFolder = (extractedEntries.length === 1 && extractedEntries[0].isDirectory() && extractedEntries[0].name === (item.id + '_' + item.version));
				
				if(!fs.existsSync(siteLocation)){
					fs.mkdirSync(siteLocation, { recursive: true });
				}

				if(hasSingleMatchingFolder){
					// Move that folder to siteLocation
					let srcFolder = path.join(tempExtractDir, extractedEntries[0].name);
					fs.cpSync(srcFolder, targetPluginDir, { recursive: true });
				} else {
					// The contents inside tempExtractDir ARE the plugin files (manifest.json, plugin.js, etc.)
					fs.cpSync(tempExtractDir, targetPluginDir, { recursive: true });
				}

				// Clean up temporary extraction directory
				try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch(e){}

				callback(null, {
					"id": item.id,
					"version": item.version,
					"siteId": item.siteId,
					"targetDir": targetPluginDir,
					"status": "installed"
				});
			});
		})
		.catch(function(err){
			callback(err);
		});
}

/*
	* POST /apaf-updater/install
	* Body: { "plugins": [{ "id": "pluginId", "version": "1.0.0", "siteId": "apaf" }] }
	* Extracts downloaded archives and installs them into their target site locations.
	*/
plugin.installPluginsHandler = function(req,res){
	plugin.debug('->installPluginsHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.updater.install.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-installPluginsHandler() - error access');
			res.json({"status": 500,"message": err,"data": null});
		}else{
			let body = req.body || {};
			let targetPlugins = body.plugins || [];
			let configRef = body.configuration || null;
			let configDescriptor = null;
			if(configRef){
				// a global configuration can only be activated after it has been resolved
				configDescriptor = plugin._resolvedConfigurations[configRef.id + '@' + configRef.version];
				if(!configDescriptor){
					res.json({"status": 400,"message": "Configuration " + configRef.id + "@" + configRef.version + " has not been resolved - call /configuration/resolve first","data": null});
					return;
				}
			}
			if(!Array.isArray(targetPlugins) || (targetPlugins.length===0 && !configRef)){
				res.json({"status": 400,"message": "Missing 'plugins' array in request body","data": null});
				return;
			}
			let previousActive = configRef ? plugin._readActiveConfiguration() : null;
			if(targetPlugins.length===0){
				// configuration already satisfied by the installed plugins: only the marker changes
				plugin._writeActiveConfiguration(plugin._buildActiveConfiguration(configDescriptor, user ? user.login : 'system'));
				plugin.debug('<-installPluginsHandler() - configuration activated without installation');
				res.json({"status": 200,"message": "ok","data": { "activated": true, "configuration": { "id": configRef.id, "version": configRef.version } }});
				return;
			}

			let jobService = plugin.getService(JOB_SERVICE_NAME);
			let owner = user ? user.login : 'system';
			let jobDesc = 'Install updates for ' + targetPlugins.map(function(p){ return p.id + '@' + p.version; }).join(', ');
			let job = jobService.createJob(owner, jobDesc, true);
			job.status = STATUS_ONGOING;
			job.progress = 0;
			job.installReport = {
				"total": targetPlugins.length,
				"installed": 0,
				"failed": 0,
				"items": []
			};
			jobService.updateJob(job);

			// Return job immediately to caller
			res.json({"status": 200,"message": "ok","data": { "jobId": job.id, "job": job }});

			// Run installation queue asynchronously
			let idx = 0;
			let installNext = function(){
				if(idx >= targetPlugins.length){
					job.progress = 100;
					job.status = (job.installReport.failed === 0) ? STATUS_COMPLETED : STATUS_SETROLLBACKONLY;
					if(job.installReport.installed > 0){
						plugin._writeSiteUpdateManifests(job.installReport.items, owner, configRef ? { "id": configRef.id, "version": configRef.version, "previous": previousActive } : null);
					}
					if(configRef && job.installReport.failed === 0){
						plugin._writeActiveConfiguration(plugin._buildActiveConfiguration(configDescriptor, owner));
					}
					jobService.updateJob(job);
					plugin.debug('<-installPluginsHandler() - background job finished ' + job.id + ' status=' + job.status);
					return;
				}

				let item = targetPlugins[idx];
				plugin._installPlugin(item, function(iErr, result){
					if(iErr){
						plugin.error('Failed to install ' + item.id + '_' + item.version + ': ' + iErr.message);
						job.installReport.failed++;
						job.installReport.items.push({
							"id": item.id,
							"version": item.version,
							"siteId": item.siteId,
							"status": "error",
							"error": iErr.message
						});
					}else{
						job.installReport.installed++;
						job.installReport.items.push({
							"id": item.id,
							"version": item.version,
							"siteId": item.siteId,
							"currentVersion": item.currentVersion || null,
							"action": item.action || (item.currentVersion ? "update" : "install"),
							"status": "success",
							"targetDir": result.targetDir
						});
					}
					idx++;
					job.progress = Math.round((idx / targetPlugins.length) * 100);
					jobService.updateJob(job);
					installNext();
				});
			};

			setTimeout(installNext, 10);
		}
	});
}

/*
	* GET /apaf-updater/checkpoints
	* Scans all configured installation sites for update_*.json manifest files.
	* Returns a list of checkpoints grouped by timestamp/date.
	*/
plugin.getCheckpointsHandler = function(req,res){
	plugin.debug('->getCheckpointsHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.updater.checkpoints.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getCheckpointsHandler() - error access');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let sites = plugin.runtime.config.sites || [];
			let checkpointsMap = {}; // timestamp -> { timestamp, date, installedBy, siteManifests: [] }

			for(let i=0;i<sites.length;i++){
				let site = sites[i];
				let siteLocation = site.location;
				if(siteLocation && fs.existsSync(siteLocation)){
					try{
						let files = fs.readdirSync(siteLocation, { withFileTypes: true });
						for(let j=0;j<files.length;j++){
							let f = files[j];
							if(f.isFile() && f.name.startsWith('update_') && f.name.endsWith('.json')){
								let fullPath = path.join(siteLocation, f.name);
								try{
									let content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
									let ts = content.timestamp || f.name.replace(/^update_/, '').replace(/\.json$/, '');
									if(!checkpointsMap[ts]){
										checkpointsMap[ts] = {
											"timestamp": ts,
											"date": content.date || null,
											"installedBy": content.installedBy || 'system',
											"sites": []
										};
									}
									checkpointsMap[ts].sites.push({
										"siteId": content.siteId || site.id,
										"siteLocation": siteLocation,
										"manifestFile": fullPath,
										"manifestFileName": f.name,
										"plugins": content.plugins || []
									});
								}catch(parseErr){
									plugin.error('Error parsing checkpoint manifest ' + fullPath + ': ' + parseErr.message);
								}
							}
						}
					}catch(readErr){
						plugin.error('Error reading site directory ' + siteLocation + ': ' + readErr.message);
					}
				}
			}

			let list = [];
			for(let ts in checkpointsMap){
				list.push(checkpointsMap[ts]);
			}
			// Sort most recent first
			list.sort(function(a,b){
				return b.timestamp.localeCompare(a.timestamp);
			});

			plugin.debug('<-getCheckpointsHandler() - found ' + list.length + ' checkpoints');
			res.json({"status": 200,"message": "ok","data": list});
		}
	});
}

/*
	* POST /apaf-updater/rollback
	* Body: { "timestamp": "20261001_143022" }
	* Performs a rollback of all plugin updates recorded at that timestamp:
	* - Removes the targetDir (<pluginId>_<version>) of the installed plugins
	* - Deletes or marks the update_<timestamp>.json manifest file in each site
	*/
plugin.rollbackHandler = function(req,res){
	plugin.debug('->rollbackHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.updater.rollback.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-rollbackHandler() - error access');
			res.json({"status": 500,"message": err,"data": null});
		}else{
			let body = req.body || {};
			let timestamp = body.timestamp;
			if(!timestamp){
				res.json({"status": 400,"message": "Missing 'timestamp' in request body","data": null});
				return;
			}

			let sites = plugin.runtime.config.sites || [];

			// Check that this is indeed the latest checkpoint (LIFO rule)
			let allTimestamps = [];
			for(let i=0;i<sites.length;i++){
				let siteLoc = sites[i].location;
				if(siteLoc && fs.existsSync(siteLoc)){
					let files = fs.readdirSync(siteLoc, { withFileTypes: true });
					for(let j=0;j<files.length;j++){
						let f = files[j];
						if(f.isFile() && f.name.startsWith('update_') && f.name.endsWith('.json')){
							let ts = f.name.replace(/^update_/, '').replace(/\.json$/, '');
							if(allTimestamps.indexOf(ts) < 0) allTimestamps.push(ts);
						}
					}
				}
			}
			allTimestamps.sort(function(a,b){ return b.localeCompare(a); });
			if(allTimestamps.length > 0 && allTimestamps[0] !== timestamp){
				res.json({"status": 400,"message": "@apaf.updater.error.not.latest.checkpoint","data": null});
				return;
			}
			let configurationRestored = false;
			let rollbackReport = {
				"timestamp": timestamp,
				"executedBy": user ? user.login : 'system',
				"revertedPlugins": [],
				"errors": []
			};

			for(let i=0;i<sites.length;i++){
				let site = sites[i];
				let siteLocation = site.location;
				let manifestFile = path.join(siteLocation, 'update_' + timestamp + '.json');
				if(fs.existsSync(manifestFile)){
					try{
						let content = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
						if(content.configuration && !configurationRestored){
							// the checkpoint activated a global configuration: restore the previous one
							plugin._writeActiveConfiguration(content.configuration.previous || null);
							configurationRestored = true;
							rollbackReport.configurationRestored = content.configuration.previous ? (content.configuration.previous.id + '@' + content.configuration.previous.version) : null;
						}
						let plugins = content.plugins || [];
						for(let j=0;j<plugins.length;j++){
							let p = plugins[j];
							let targetDir = p.targetDir || path.join(siteLocation, p.id + '_' + p.version);
							if(fs.existsSync(targetDir)){
								try{
									plugin.info('Rollback: deleting plugin folder ' + targetDir);
									fs.rmSync(targetDir, { recursive: true, force: true });
									rollbackReport.revertedPlugins.push({
										"id": p.id,
										"version": p.version,
										"previousVersion": p.previousVersion || null,
										"siteId": site.id,
										"deletedDir": targetDir,
										"status": "reverted"
									});
								}catch(rmErr){
									plugin.error('Failed to remove ' + targetDir + ': ' + rmErr.message);
									rollbackReport.errors.push({
										"id": p.id,
										"targetDir": targetDir,
										"error": rmErr.message
									});
								}
							} else {
								rollbackReport.revertedPlugins.push({
									"id": p.id,
									"version": p.version,
									"previousVersion": p.previousVersion || null,
									"siteId": site.id,
									"deletedDir": targetDir,
									"status": "not_found"
								});
							}
						}

						// Archive checkpoint manifest with .reverted extension and audit metadata
						try{
							content.revertedAt = new Date().toISOString();
							content.revertedBy = user ? user.login : 'system';
							let revertedManifestFile = manifestFile + '.reverted';
							fs.writeFileSync(revertedManifestFile, JSON.stringify(content, null, '\t'), 'utf8');
							fs.rmSync(manifestFile, { force: true });
							plugin.info('Checkpoint manifest archived to: ' + revertedManifestFile);
						}catch(delErr){
							plugin.error('Failed to archive manifest ' + manifestFile + ': ' + delErr.message);
						}
					}catch(mErr){
						rollbackReport.errors.push({
							"siteLocation": siteLocation,
							"manifestFile": manifestFile,
							"error": mErr.message
						});
					}
				}
			}

			plugin.debug('<-rollbackHandler() - reverted ' + rollbackReport.revertedPlugins.length + ' plugins, ' + rollbackReport.errors.length + ' errors');
			res.json({"status": 200,"message": "ok","data": rollbackReport});
		}
	});
}

/*
	* POST /apaf-updater/restart
	* Requests server restart by triggering runtime shutdown.
	*/
plugin.restartServerHandler = function(req,res){
	plugin.debug('->restartServerHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.updater.restart.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-restartServerHandler() - error access');
			res.json({"status": 500,"message": err,"data": null});
		}else{
			plugin.info('Server restart requested by user: ' + (user ? user.login : 'anonymous'));
			res.json({"status": 200,"message": "restarting","data": {"scheduled": true}});
			if(plugin.runtime && typeof plugin.runtime.shutdown === 'function'){
				plugin.runtime.shutdown(0, 1000);
			} else {
				setTimeout(function(){ process.exit(0); }, 1000);
			}
		}
	});
}

/* ==========================================================================
 * Global configuration support (since 1.1.0)
 *
 * A configuration is a named, versioned set of pinned plugin versions ("apaf 1.2.0") published
 * on the update site, next to pluginMap.json:
 *   <baseUrl>/configMap.json                                       index of the available configurations
 *   <baseUrl>/configurations/<id>_<version>/configuration.json     descriptor (pinned plugins)
 * The configuration id is the NPA application name (property npa.application.name).
 * The active configuration is recorded locally in activeConfiguration.json.
 * ========================================================================== */

const CONFIG_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const CONFIG_VERSION_PATTERN = /^\d+(\.\d+)*$/;

/*
 * Common frame for the secured handlers: JSON content type + security check.
 */
plugin._secured = function(extensionId,req,res,then){
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole(extensionId);
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-'+extensionId+' - error access');
			res.json({"status": 500,"message": err,"data": null});
		}else{
			then(user);
		}
	});
}

/*
 * Returns the NPA application name (e.g. "apaf"), used as the configuration id.
 */
plugin._getApplicationName = function(){
	let propService = plugin.getService('properties');
	let name = propService ? propService.getProperty('npa.application.name') : null;
	return name || DEFAULT_CONFIG_ID;
}

/*
 * Returns { pluginId: { version, siteId } } for every plugin known by the runtime.
 */
plugin._getInstalledIndex = function(){
	let runtimeMap = plugin.runtime.map;
	let installedIndex = {};
	for(let pluginId in runtimeMap){
		let entry = runtimeMap[pluginId];
		let pluginConfig = entry.pluginConfig || entry;
		let manifest = pluginConfig.manifest;
		if(!manifest) continue;
		let siteId = (pluginConfig.siteConfig && pluginConfig.siteConfig.id) ? pluginConfig.siteConfig.id : null;
		installedIndex[manifest.id] = {"version": manifest.version,"siteId": siteId};
	}
	return installedIndex;
}

/*
 * Returns the distinct update site base URLs declared in the site configuration.
 */
plugin._getUpdateSiteBaseUrls = function(){
	let sites = plugin.runtime.config.sites || [];
	let urls = [];
	for(let i=0;i<sites.length;i++){
		if(sites[i].updateSiteUrl){
			let baseUrl = plugin._normalizeUpdateSiteBaseUrl(sites[i].updateSiteUrl);
			if(urls.indexOf(baseUrl)<0){
				urls.push(baseUrl);
			}
		}
	}
	return urls;
}

/*
 * GETs a JSON resource located at <baseUrl>/<relativePath>.
 */
plugin._fetchRemoteJson = function(baseUrl,relativePath,callback){
	let restPlugin = plugin.runtime.getPlugin(REST_PLUGIN_ID);
	let restContext = plugin._parseUpdateSiteUrl(baseUrl + '/' + relativePath);
	restContext.method = 'GET';
	restPlugin.performRestApiCall(restContext,function(err,response){
		if(err){
			callback(err);
		}else{
			callback(null,response.data);
		}
	});
}

/*
 * Location of the file recording the active configuration: next to the site configuration file
 * (NPA_SITE_CONFIG / APAF_INSTALLATION), or in the 'default' site location when it is not known.
 */
plugin._getActiveConfigurationFile = function(){
	let siteConfigPath = process.env.NPA_SITE_CONFIG || process.env.APAF_INSTALLATION;
	let dir = siteConfigPath ? path.dirname(path.resolve(siteConfigPath)) : path.resolve(plugin._getSiteLocation('default'));
	return path.join(dir,ACTIVE_CONFIG_FILE);
}

/*
 * Returns the recorded active configuration, or null.
 */
plugin._readActiveConfiguration = function(){
	let file = plugin._getActiveConfigurationFile();
	try{
		if(fs.existsSync(file)){
			return JSON.parse(fs.readFileSync(file,'utf8'));
		}
	}catch(err){
		plugin.error('Unable to read active configuration '+file+': '+err.message);
	}
	return null;
}

/*
 * Records the given active configuration; a null value clears it.
 */
plugin._writeActiveConfiguration = function(activeConfiguration){
	let file = plugin._getActiveConfigurationFile();
	try{
		if(activeConfiguration){
			fs.writeFileSync(file,JSON.stringify(activeConfiguration,null,'\t'),'utf8');
			plugin.info('Active configuration is now '+activeConfiguration.id+'@'+activeConfiguration.version+' ('+file+')');
		}else if(fs.existsSync(file)){
			fs.rmSync(file,{force: true});
			plugin.info('Active configuration cleared ('+file+')');
		}
	}catch(err){
		plugin.error('Unable to write active configuration '+file+': '+err.message);
	}
}

plugin._buildActiveConfiguration = function(descriptor,userLogin){
	return {
		"id": descriptor.id,
		"version": descriptor.version,
		"name": descriptor.name||descriptor.id,
		"activatedAt": new Date().toISOString(),
		"activatedBy": userLogin||'system',
		"plugins": descriptor.plugins.map(function(p){
			return {"id": p.id,"version": p.version,"siteId": p.siteId||null};
		})
	};
}

/*
 * Validates the structure of a configuration descriptor. Returns an error message, or null.
 */
plugin._validateConfigurationDescriptor = function(descriptor,id,version){
	if(!descriptor || typeof descriptor!='object'){
		return 'Invalid configuration descriptor';
	}
	if(descriptor.id!=id || descriptor.version!=version){
		return 'Configuration descriptor does not match '+id+'@'+version;
	}
	if(!Array.isArray(descriptor.plugins) || descriptor.plugins.length==0){
		return 'Configuration '+id+'@'+version+' does not pin any plugin';
	}
	for(let i=0;i<descriptor.plugins.length;i++){
		let p = descriptor.plugins[i];
		if(!p || typeof p.id!='string' || typeof p.version!='string' || !CONFIG_VERSION_PATTERN.test(p.version)){
			return 'Invalid plugin entry #'+i+' in configuration '+id+'@'+version;
		}
	}
	return null;
}

/*
 * Compares pinned plugins with the installed ones. A pinned plugin is satisfied when the installed
 * version is greater than or equal to the pinned one (same semantic as the NPA kernel).
 */
plugin._computeCompliance = function(pinnedPlugins,installedIndex){
	let missing = [];
	let outdated = [];
	let pinnedIds = {};
	for(let i=0;i<pinnedPlugins.length;i++){
		let p = pinnedPlugins[i];
		pinnedIds[p.id] = true;
		let cur = installedIndex[p.id];
		if(!cur){
			missing.push({"id": p.id,"expectedVersion": p.version,"siteId": p.siteId||null});
		}else if(plugin._compareVersion(cur.version,p.version)<0){
			outdated.push({"id": p.id,"expectedVersion": p.version,"installedVersion": cur.version,"siteId": p.siteId||cur.siteId});
		}
	}
	let extra = [];
	for(let pid in installedIndex){
		if(!pinnedIds[pid]){
			extra.push(pid);
		}
	}
	extra.sort();
	return {
		"compliant": (missing.length==0 && outdated.length==0),
		"missing": missing,
		"outdated": outdated,
		"extra": extra
	};
}

/*
 * Reads configMap.json on every update site. callback({ entries: [...], unreachable: [baseUrl] })
 */
plugin._fetchConfigMaps = function(callback){
	let urls = plugin._getUpdateSiteBaseUrls();
	let entries = [];
	let unreachable = [];
	let fetchNext = function(idx){
		if(idx>=urls.length){
			callback({"entries": entries,"unreachable": unreachable});
			return;
		}
		let baseUrl = urls[idx];
		plugin._fetchRemoteJson(baseUrl,CONFIG_MAP_FILE,function(err,configMap){
			if(err){
				plugin.info('No configuration index available at '+baseUrl+'/'+CONFIG_MAP_FILE+': '+err);
				unreachable.push(baseUrl);
			}else if(configMap && Array.isArray(configMap.configurations)){
				for(let i=0;i<configMap.configurations.length;i++){
					let c = configMap.configurations[i];
					if(c && typeof c.id=='string' && typeof c.version=='string' && CONFIG_VERSION_PATTERN.test(c.version)){
						entries.push(Object.assign({},c,{"updateSiteBaseUrl": baseUrl}));
					}
				}
			}
			fetchNext(idx+1);
		});
	};
	fetchNext(0);
}

/*
 * Fetches and validates the descriptor of a configuration from the first update site providing it.
 */
plugin._fetchConfigDescriptor = function(id,version,callback){
	let urls = plugin._getUpdateSiteBaseUrls();
	let relativePath = CONFIG_FOLDER+'/'+id+'_'+version+'/'+CONFIG_DESCRIPTOR_FILE;
	let lastError = new Error('No update site configured');
	let fetchNext = function(idx){
		if(idx>=urls.length){
			callback(lastError);
			return;
		}
		plugin._fetchRemoteJson(urls[idx],relativePath,function(err,descriptor){
			if(err){
				lastError = new Error('Configuration '+id+'@'+version+' not found on '+urls[idx]);
				fetchNext(idx+1);
			}else{
				let invalid = plugin._validateConfigurationDescriptor(descriptor,id,version);
				if(invalid){
					lastError = new Error(invalid);
					fetchNext(idx+1);
				}else{
					callback(null,descriptor);
				}
			}
		});
	};
	fetchNext(0);
}

/*
 * GET /apaf-updater/configuration/active
 * Returns the recorded active configuration and its compliance against the installed plugins.
 */
plugin.getActiveConfigurationHandler = function(req,res){
	plugin.debug('->getActiveConfigurationHandler()');
	plugin._secured('apaf.updater.configuration.active.handler',req,res,function(user){
		let active = plugin._readActiveConfiguration();
		let data = {
			"applicationName": plugin._getApplicationName(),
			"active": active,
			"compliance": active ? plugin._computeCompliance(active.plugins||[],plugin._getInstalledIndex()) : null
		};
		plugin.debug('<-getActiveConfigurationHandler()');
		res.json({"status": 200,"message": "ok","data": data});
	});
}

/*
 * GET /apaf-updater/configuration/check[?id=<configurationId>]
 * Lists the configurations published on the update sites for the application, newest first.
 */
plugin.checkConfigurationHandler = function(req,res){
	plugin.debug('->checkConfigurationHandler()');
	plugin._secured('apaf.updater.configuration.check.handler',req,res,function(user){
		let configId = req.query.id || plugin._getApplicationName();
		if(!CONFIG_ID_PATTERN.test(configId)){
			res.json({"status": 400,"message": "Invalid configuration id","data": null});
			return;
		}
		plugin._fetchConfigMaps(function(result){
			let active = plugin._readActiveConfiguration();
			let activeVersion = (active && active.id==configId) ? active.version : null;
			let seen = {};
			let available = [];
			for(let i=0;i<result.entries.length;i++){
				let e = result.entries[i];
				if(e.id==configId && !seen[e.version]){
					seen[e.version] = true;
					available.push({
						"id": e.id,
						"version": e.version,
						"name": e.name||e.id,
						"description": e.description||'',
						"channel": e.channel||null,
						"updateSiteBaseUrl": e.updateSiteBaseUrl,
						"newer": activeVersion ? (plugin._compareVersion(e.version,activeVersion)>0) : true,
						"active": (e.version==activeVersion)
					});
				}
			}
			available.sort(function(a,b){ return plugin._compareVersion(b.version,a.version); });
			plugin.debug('<-checkConfigurationHandler() - '+available.length+' configuration(s)');
			res.json({"status": 200,"message": "ok","data": {
				"id": configId,
				"active": active,
				"available": available,
				"unreachable": result.unreachable
			}});
		});
	});
}

/*
 * POST /apaf-updater/configuration/resolve
 * Body: { "id": "apaf" (optional), "version": "1.2.0" }
 * Builds the installation plan bringing the installed plugins to the pinned versions of the
 * configuration, using the same result format as POST /resolve. The descriptor is kept in memory:
 * POST /install can then activate the configuration (body.configuration).
 */
plugin.resolveConfigurationHandler = function(req,res){
	plugin.debug('->resolveConfigurationHandler()');
	plugin._secured('apaf.updater.configuration.resolve.handler',req,res,function(user){
		let body = req.body || {};
		let configId = body.id || plugin._getApplicationName();
		let version = body.version;
		if(!CONFIG_ID_PATTERN.test(configId) || typeof version!='string' || !CONFIG_VERSION_PATTERN.test(version)){
			res.json({"status": 400,"message": "Missing or invalid configuration 'id' / 'version'","data": null});
			return;
		}
		plugin._fetchConfigDescriptor(configId,version,function(fetchErr,descriptor){
			if(fetchErr){
				plugin.error('Error fetching configuration '+configId+'@'+version+': '+fetchErr.message);
				res.json({"status": 404,"message": fetchErr.message,"data": null});
				return;
			}
			let installedIndex = plugin._getInstalledIndex();
			let pinnedCatalog = {};
			let targets = [];
			for(let i=0;i<descriptor.plugins.length;i++){
				let p = descriptor.plugins[i];
				pinnedCatalog[p.id] = {"id": p.id,"version": p.version,"siteId": p.siteId||'default'};
				let cur = installedIndex[p.id];
				if(!cur || plugin._compareVersion(cur.version,p.version)<0){
					targets.push({"id": p.id,"version": p.version,"siteId": p.siteId||(cur ? cur.siteId : 'default')});
				}
			}
			let done = function(resolution){
				plugin._resolvedConfigurations[configId+'@'+version] = descriptor;
				resolution.configuration = {
					"id": descriptor.id,
					"version": descriptor.version,
					"name": descriptor.name||descriptor.id,
					"description": descriptor.description||'',
					"releaseNotes": descriptor.releaseNotes||''
				};
				resolution.alreadySatisfied = (resolution.toInstall.length==0 && resolution.canInstall);
				plugin.debug('<-resolveConfigurationHandler() - canInstall='+resolution.canInstall+', toInstall='+resolution.toInstall.length);
				res.json({"status": 200,"message": "ok","data": resolution});
			};
			if(targets.length==0){
				done({"canInstall": true,"toInstall": [],"missingDependencies": []});
				return;
			}
			plugin._resolveDependencies(targets,function(resErr,resolution){
				if(resErr){
					plugin.error('Error during configuration resolution: '+resErr.message);
					res.json({"status": 500,"message": resErr.message,"data": null});
				}else{
					done(resolution);
				}
			},pinnedCatalog);
		});
	});
}

/*
 * POST /apaf-updater/configuration/snapshot
 * Body: { "version": "1.2.0", "id": "apaf" (optional), "name": "...", "description": "...",
 *         "releaseNotes": "...", "channel": "stable" }
 * Generates the configuration descriptor from the plugins currently installed (only those belonging
 * to a site having an updateSiteUrl, so that the configuration can be resolved from the update site).
 * The descriptor and the configMap.json entry are returned and the descriptor is written in the
 * downloads temporary directory, ready to be published on the update site.
 */
plugin.snapshotConfigurationHandler = function(req,res){
	plugin.debug('->snapshotConfigurationHandler()');
	plugin._secured('apaf.updater.configuration.snapshot.handler',req,res,function(user){
		let body = req.body || {};
		let configId = body.id || plugin._getApplicationName();
		let version = body.version;
		if(!CONFIG_ID_PATTERN.test(configId) || typeof version!='string' || !CONFIG_VERSION_PATTERN.test(version)){
			res.json({"status": 400,"message": "Missing or invalid configuration 'id' / 'version'","data": null});
			return;
		}
		let sites = plugin.runtime.config.sites || [];
		let publishableSites = {};
		for(let i=0;i<sites.length;i++){
			if(sites[i].updateSiteUrl){
				publishableSites[sites[i].id] = true;
			}
		}
		let installedIndex = plugin._getInstalledIndex();
		let pinned = [];
		for(let pid in installedIndex){
			if(publishableSites[installedIndex[pid].siteId]){
				pinned.push({"id": pid,"version": installedIndex[pid].version,"siteId": installedIndex[pid].siteId});
			}
		}
		pinned.sort(function(a,b){ return a.id.localeCompare(b.id); });
		if(pinned.length==0){
			res.json({"status": 400,"message": "No installed plugin belongs to a site with an updateSiteUrl","data": null});
			return;
		}
		let descriptor = {
			"id": configId,
			"version": version,
			"name": body.name||configId,
			"description": body.description||'',
			"releaseNotes": body.releaseNotes||'',
			"createdAt": new Date().toISOString(),
			"createdBy": user ? user.login : 'system',
			"plugins": pinned
		};
		let mapEntry = {"id": configId,"version": version,"name": descriptor.name};
		if(body.channel){
			mapEntry.channel = body.channel;
		}
		if(body.description){
			mapEntry.description = body.description;
		}
		let relativePath = CONFIG_FOLDER+'/'+configId+'_'+version+'/'+CONFIG_DESCRIPTOR_FILE;
		let result = {
			"descriptor": descriptor,
			"configMapEntry": mapEntry,
			"publishPath": relativePath,
			"file": null
		};
		try{
			let targetDir = path.join(plugin._getDownloadsTempDir(),CONFIG_FOLDER,configId+'_'+version);
			fs.mkdirSync(targetDir,{recursive: true});
			result.file = path.join(targetDir,CONFIG_DESCRIPTOR_FILE);
			fs.writeFileSync(result.file,JSON.stringify(descriptor,null,'\t'),'utf8');
		}catch(wErr){
			plugin.error('Unable to write configuration snapshot: '+wErr.message);
		}
		plugin.debug('<-snapshotConfigurationHandler() - '+pinned.length+' plugin(s) pinned');
		res.json({"status": 200,"message": "ok","data": result});
	});
}


/*
	* Parse a full URL string into a restContext object suitable for npa.rest.
	*/
plugin._parseUpdateSiteUrl = function(url){
	let secured = url.startsWith('https');
	let withoutProto = url.replace(/^https?:\/\//,'');
	let slashIdx = withoutProto.indexOf('/');
	let hostPort = slashIdx>=0 ? withoutProto.substring(0,slashIdx) : withoutProto;
	let uri = slashIdx>=0 ? withoutProto.substring(slashIdx) : '/';
	let colonIdx = hostPort.lastIndexOf(':');
	let host = colonIdx>=0 ? hostPort.substring(0,colonIdx) : hostPort;
	let port = colonIdx>=0 ? parseInt(hostPort.substring(colonIdx+1)) : (secured?443:80);
	return {
		"host": host,
		"port": port,
		"secured": secured,
		"acceptCertificate": true,
		"uri": uri,
		"payload": {}
	};
}

/*
 * Compare two semver strings. Returns >0 if v1>v2, <0 if v1<v2, 0 if equal.
 */
plugin._compareVersion = function(v1,v2){
	if(!v1) return v2 ? -1 : 0;
	if(!v2) return 1;
	let a = v1.split('.').map(Number);
	let b = v2.split('.').map(Number);
	while(a.length<b.length) a.push(0);
	while(b.length<a.length) b.push(0);
	for(let i=0;i<a.length;i++){
		if(a[i]>b[i]) return 1;
		if(a[i]<b[i]) return -1;
	}
	return 0;
}

module.exports = plugin;
