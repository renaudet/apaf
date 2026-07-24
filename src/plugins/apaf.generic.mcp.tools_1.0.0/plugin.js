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
const FRAGMENT_DATATYPE = 'fragment';
const MCP_TOOL_TYPE = 'mcpTool';

var plugin = new ApafPlugin();
var xeval = eval;

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
 * apaf.dyn.api.invokeServlet(). The fragment source must expose a
 * servlet.endpoint(payload, context, callback) function.
 */
plugin.invokeMcpTool = function(fragment, args, user, httpRequest, httpResponse, then) {
	this.debug('->invokeMcpTool(' + fragment.name + ')');
	try {
		let moduleSrc = 'var servlet = {}; var initializeServlet = function(){' + fragment.source + '}';
		xeval(moduleSrc);
		initializeServlet();
		if (typeof servlet.endpoint !== 'undefined') {
			let context = {
				user: user,
				runtime: plugin.runtime,
				require: require,
				httpRequest: httpRequest,
				httpResponse: httpResponse
			};
			servlet.endpoint(args, context, then);
			this.debug('<-invokeMcpTool() - invoked');
		} else {
			this.debug('<-invokeMcpTool() - no endpoint');
			then('mcpTool fragment "' + fragment.name + '" has no endpoint', null);
		}
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
		let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		let query = { selector: { type: { $eq: MCP_TOOL_TYPE } } };
		datatypePlugin.query(FRAGMENT_DATATYPE, query, function(err, fragments) {
			if (err) {
				plugin.debug('<-getDynamicMcpToolListHandler() - error query');
				res.json({ status: 500, message: err, data: [] });
				return;
			}
			let tools = [];
			for (let fragment of fragments) {
				let parsed = plugin.parseApiDoc(fragment);
				tools.push({
					name: parsed.toolName,
					description: parsed.toolDescription,
					inputSchema: parsed.inputSchema
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
		let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		let query = { selector: { type: { $eq: MCP_TOOL_TYPE } } };
		datatypePlugin.query(FRAGMENT_DATATYPE, query, function(err, fragments) {
			if (err) {
				plugin.debug('<-invokeDynamicToolHandler() - error query');
				res.json({ status: 500, message: err, data: [] });
				return;
			}
			// Match on operationId (from apiDoc) or on fragment.name
			let target = null;
			for (let fragment of fragments) {
				let parsed = plugin.parseApiDoc(fragment);
				if (parsed.toolName === toolName) {
					target = fragment;
					break;
				}
			}
			if (!target) {
				plugin.debug('<-invokeDynamicToolHandler() - tool not found: ' + toolName);
				res.json({ status: 404, message: 'Tool "' + toolName + '" not found', data: [] });
				return;
			}
			plugin.invokeMcpTool(target, args, user, req, res, function(err, result) {
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
