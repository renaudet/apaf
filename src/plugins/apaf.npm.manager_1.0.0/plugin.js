/*
 * plugin.js - APAF NPM Package Manager Plugin
 * Copyright 2026 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const UPDATER_PLUGIN_ID = 'apaf.updater';

var plugin = new ApafPlugin();

/*
 * GET /packages
 * Return the full inventory of NPM packages, their installed version, target versions and consumers.
 */
plugin.getPackagesHandler = function(req, res){
	plugin.debug('->getPackagesHandler()');
	res.set('Content-Type', 'application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.npm.manager.packages.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	
	securityEngine.checkUserAccess(req, requiredRole, function(err, user){
		if(err){
			plugin.debug('<-getPackagesHandler() - access error');
			res.json({ "status": 500, "message": err, "data": null });
		} else {
			try {
				let updater = plugin.runtime.getPlugin(UPDATER_PLUGIN_ID);
				if(!updater){
					res.json({ "status": 500, "message": "Plugin apaf.updater is not available", "data": null });
					return;
				}
				let report = updater.getNpmPackagesReport();
				res.json({ "status": 200, "message": "ok", "data": report });
			} catch(e) {
				plugin.error('Error fetching NPM packages report: ' + e.message);
				res.json({ "status": 500, "message": e.message, "data": null });
			}
		}
	});
};

/*
 * POST /install
 * Add or update a user-defined NPM package.
 */
plugin.installPackageHandler = function(req, res){
	plugin.debug('->installPackageHandler()');
	res.set('Content-Type', 'application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.npm.manager.install.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	
	securityEngine.checkUserAccess(req, requiredRole, function(err, user){
		if(err){
			plugin.debug('<-installPackageHandler() - access error');
			res.json({ "status": 500, "message": err, "data": null });
		} else {
			let body = req.body || {};
			let name = body.name ? body.name.trim() : '';
			let version = body.version ? body.version.trim() : 'latest';
			
			if(!name){
				res.json({ "status": 400, "message": "Missing 'name' in request body", "data": null });
				return;
			}
			
			let updater = plugin.runtime.getPlugin(UPDATER_PLUGIN_ID);
			if(!updater){
				res.json({ "status": 500, "message": "Plugin apaf.updater is not available", "data": null });
				return;
			}
			
			updater.installUserNpmPackage(name, version, function(iErr, result){
				if(iErr){
					plugin.error('Error installing NPM package ' + name + ': ' + iErr.message);
					res.json({ "status": 500, "message": iErr.message, "data": result });
				} else {
					plugin.info('User NPM package ' + name + '@' + version + ' installed/reconciled by ' + (user ? user.login : 'admin'));
					res.json({ "status": 200, "message": "ok", "data": result });
				}
			});
		}
	});
};

/*
 * POST /uninstall
 * Remove a user-defined NPM package.
 */
plugin.uninstallPackageHandler = function(req, res){
	plugin.debug('->uninstallPackageHandler()');
	res.set('Content-Type', 'application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.npm.manager.uninstall.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	
	securityEngine.checkUserAccess(req, requiredRole, function(err, user){
		if(err){
			plugin.debug('<-uninstallPackageHandler() - access error');
			res.json({ "status": 500, "message": err, "data": null });
		} else {
			let body = req.body || {};
			let name = body.name ? body.name.trim() : '';
			
			if(!name){
				res.json({ "status": 400, "message": "Missing 'name' in request body", "data": null });
				return;
			}
			
			let updater = plugin.runtime.getPlugin(UPDATER_PLUGIN_ID);
			if(!updater){
				res.json({ "status": 500, "message": "Plugin apaf.updater is not available", "data": null });
				return;
			}
			
			updater.uninstallUserNpmPackage(name, function(uErr, result){
				if(uErr){
					plugin.error('Error uninstalling NPM package ' + name + ': ' + uErr.message);
					res.json({ "status": 500, "message": uErr.message, "data": result });
				} else {
					plugin.info('User NPM package ' + name + ' removed by ' + (user ? user.login : 'admin'));
					res.json({ "status": 200, "message": "ok", "data": result });
				}
			});
		}
	});
};

/*
 * POST /reconcile
 * Trigger full reconciliation of package.json and execute npm install.
 */
plugin.reconcileHandler = function(req, res){
	plugin.debug('->reconcileHandler()');
	res.set('Content-Type', 'application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.npm.manager.reconcile.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	
	securityEngine.checkUserAccess(req, requiredRole, function(err, user){
		if(err){
			plugin.debug('<-reconcileHandler() - access error');
			res.json({ "status": 500, "message": err, "data": null });
		} else {
			let updater = plugin.runtime.getPlugin(UPDATER_PLUGIN_ID);
			if(!updater){
				res.json({ "status": 500, "message": "Plugin apaf.updater is not available", "data": null });
				return;
			}
			
			updater.reconcileNpmDependencies(function(rErr, result){
				if(rErr){
					plugin.error('Error reconciling NPM dependencies: ' + rErr.message);
					res.json({ "status": 500, "message": rErr.message, "data": result });
				} else {
					plugin.info('NPM dependencies manually reconciled by ' + (user ? user.login : 'admin'));
					res.json({ "status": 200, "message": "ok", "data": result });
				}
			});
		}
	});
};

module.exports = plugin;
