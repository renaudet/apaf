/*
 * plugin.js - Generic MCP Tools provider for APAF
 * Copyright 2026 - All rights reserved
 *
 * Exposes two HTTP handlers mapped to MCP tools via npa.mcp plugin:
 *
 *   GET  /apaf-mcp-tools/tools   → getDynamicMcpToolListHandler (role: operator)
 *                                   Returns the list of enabled mcpTool fragments
 *
 *   POST /apaf-mcp-tools/invoke  → invokeDynamicToolHandler     (role: operator)
 *                                   Executes a named mcpTool fragment
 */
const ApafPlugin = require('../../apafUtil.js');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_SERVICE_NAME = 'apaf-security';
const EVENT_BROKER_SERVICE_NAME = 'broker';
const FRAGMENT_DATATYPE = 'fragment';
const MCP_TOOL_TYPE = 'mcpTool';

var plugin = new ApafPlugin();
var xeval = eval;

/*
 * In-memory cache: Map<operationId, fragment record>
 * Populated on first query, invalidated on apaf.fragment.changed events.
 */
plugin.toolCache = null; // null = not yet populated

plugin.invalidateToolCache = function() {
	if (plugin.toolCache !== null) {
		plugin.debug('invalidateToolCache: cache cleared');
		plugin.toolCache = null;
	}
};

/*
 * Subscribe to apaf.fragment.changed events emitted by apaf.dev.
 * Called once at startup from beforeExtensionPlugged / lazzyPlug or from the
 * first handler invocation — we use the Application Started lifecycle hook.
 */
plugin.beforeExtensionPlugged = function() {
	let broker = plugin.getService(EVENT_BROKER_SERVICE_NAME);
	broker.registerHandler('apaf.fragment.changed', 'apaf.generic.mcp.tools', function(event) {
		plugin.debug('apaf.fragment.changed received - action=' + event.data.action + ' id=' + event.data.id);
		plugin.invalidateToolCache();
	});
	plugin.debug('registered handler for apaf.fragment.changed');
};

/*
 * Load all mcpTool fragments from CouchDB and populate the cache.
 * Calls callback(err, toolCache) where toolCache is Map<operationId, fragment>.
 */
plugin.loadToolCache = function(callback) {
	let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	let query = { selector: { type: { $eq: MCP_TOOL_TYPE } } };
	datatypePlugin.query(FRAGMENT_DATATYPE, query, function(err, fragments) {
		if (err) {
			callback(err, null);
			return;
		}
		let cache = new Map();
		for (let fragment of fragments) {
			let parsed = plugin.parseApiDoc(fragment);
			cache.set(parsed.toolName, { fragment: fragment, parsed: parsed });
		}
		plugin.toolCache = cache;
		plugin.debug('loadToolCache: loaded ' + cache.size + ' mcpTool(s) into cache');
		callback(null, cache);
	});
};

/*
 * Returns the cache, loading it from CouchDB if it has been invalidated.
 */
plugin.getToolCache = function(callback) {
	if (plugin.toolCache !== null) {
		plugin.debug('getToolCache: cache hit (' + plugin.toolCache.size + ' entries)');
		callback(null, plugin.toolCache);
	} else {
		plugin.debug('getToolCache: cache miss - loading from CouchDB');
		plugin.loadToolCache(callback);
	}
};

/*
 * Extract { toolName, toolDescription, inputSchema } from an apiDoc JSON string.
 * Returns a partial descriptor when the apiDoc is absent or malformed.
 */
plugin.parseApiDoc = function(fragment) {
	if (!fragment.apiDoc) {
		return {
			toolName: fragment.name,
			toolDescription: fragment.description || fragment.name,
			inputSchema: null
		};
	}
	try {
		let raw = fragment.apiDoc;
		// Guard against double-encoded strings (stored as escaped JSON string)
		let apidoc = typeof raw === 'string' ? JSON.parse(raw) : raw;
		if (typeof apidoc === 'string') apidoc = JSON.parse(apidoc);
		let path = Object.keys(apidoc.paths)[0];
		let pathDef = apidoc.paths[path];
		let method = Object.keys(pathDef)[0];
		let operation = pathDef[method];
		let toolName = operation.operationId || fragment.name;
		let toolDescription = operation.description || operation.summary || fragment.description || toolName;
		plugin.debug('parseApiDoc: toolName=' + toolName + ' inputSchema keys=' + JSON.stringify(Object.keys(apidoc)));
		return { toolName, toolDescription, inputSchema: apidoc };
	} catch(e) {
		plugin.error('parseApiDoc error for fragment "' + fragment.name + '": ' + e.message + ' | apiDoc type=' + typeof fragment.apiDoc + ' | value=' + String(fragment.apiDoc).substring(0,80));
		return {
			toolName: fragment.name,
			toolDescription: fragment.description || fragment.name,
			inputSchema: null
		};
	}
};

/*
 * Execute an mcpTool fragment source, following the same pattern as
 * apaf.dyn.api.invokeServlet(). The fragment source must implement an
 * mcpToolEndpoint function body with argument list as (params, ctx, then)
 * The minimal fragment implementation may be : then(null,{"result": "success"});
 */
plugin.invokeMcpTool = function(fragment, args, user, httpRequest, httpResponse, then) {
	this.debug('->invokeMcpTool(' + fragment.name + ')');
	try {
		let moduleSrc = 'var mcpToolEndpoint = function(payload,context,then){';
		moduleSrc += 'context.logger.trace(\'->'+fragment.name+'()\');';
		moduleSrc += fragment.source;
		moduleSrc +=  '};';
		xeval(moduleSrc);
		let ctx = {
			user: user,
			runtime: plugin.runtime,
			require: require,
			logger: plugin,
			httpRequest: httpRequest,
			httpResponse: httpResponse
		};
		mcpToolEndpoint(args, ctx, function(err,result){
			plugin.trace('<-'+fragment.name+'() err='+err);
			then(err,result);
		});
		this.debug('<-invokeMcpTool() - invoked');
	} catch(e) {
		this.error('invokeMcpTool exception: ' + e.message);
		console.log(e);
		this.debug('<-invokeMcpTool() - error evaluation');
		then('Exception evaluating mcpTool "' + fragment.name + '": ' + e.message, null);
	}
};

/*
 * GET /apaf-mcp-tools/tools
 * Returns the list of all mcpTool fragments with their metadata.
 */
plugin.getDynamicMcpToolListHandler = function(req, res) {
	plugin.debug('->getDynamicMcpToolListHandler()');
	res.set('Content-Type', 'application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.generic.mcp.tools.list.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req, requiredRole, function(err, user) {
		if (err) {
			plugin.debug('<-getDynamicMcpToolListHandler() - error check access');
			res.json({ status: 500, message: err, data: [] });
			return;
		}
		plugin.getToolCache(function(err, cache) {
			if (err) {
				plugin.debug('<-getDynamicMcpToolListHandler() - error query');
				res.json({ status: 500, message: err, data: [] });
				return;
			}
			let tools = [];
			for (let entry of cache.values()) {
				tools.push({
					name: entry.parsed.toolName,
					description: entry.parsed.toolDescription,
					inputSchema: entry.parsed.inputSchema
				});
			}
			plugin.debug('<-getDynamicMcpToolListHandler() - success');
			res.json({ status: 200, message: 'ok', data: tools });
		});
	});
};

/*
 * POST /apaf-mcp-tools/invoke
 * Body: { toolName: "...", args: {...} }
 * Invokes the named mcpTool fragment.
 */
plugin.invokeDynamicToolHandler = function(req, res) {
	plugin.debug('->invokeDynamicToolHandler()');
	res.set('Content-Type', 'application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.generic.mcp.tools.invoke.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req, requiredRole, function(err, user) {
		if (err) {
			plugin.debug('<-invokeDynamicToolHandler() - error check access');
			res.json({ status: 500, message: err, data: [] });
			return;
		}
		let toolName = req.body.toolName;
		let args = req.body.args || {};
		if (!toolName) {
			plugin.debug('<-invokeDynamicToolHandler() - missing toolName');
			res.json({ status: 400, message: 'Missing required parameter: toolName', data: [] });
			return;
		}
		plugin.getToolCache(function(err, cache) {
			if (err) {
				plugin.debug('<-invokeDynamicToolHandler() - error query');
				res.json({ status: 500, message: err, data: [] });
				return;
			}
			let entry = cache.get(toolName);
			if (!entry) {
				plugin.debug('<-invokeDynamicToolHandler() - tool not found: ' + toolName);
				res.json({ status: 404, message: 'Tool "' + toolName + '" not found', data: [] });
				return;
			}
			plugin.invokeMcpTool(entry.fragment, args, user, req, res, function(err, result) {
				if (err) {
					plugin.debug('<-invokeDynamicToolHandler() - error invocation');
					res.json({ status: 500, message: err, data: [] });
				} else {
					plugin.debug('<-invokeDynamicToolHandler() - success');
					res.json({ status: 200, message: 'ok', data: result });
				}
			});
		});
	});
};

module.exports = plugin;
