/*
 * apafUtil.js - APAF plugin adapter class for external installation site
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const Plugin = require(process.cwd()+'/core/plugin.js');

class ApafPlugin extends Plugin{
	getRequiredSecurityRole(extensionId){
		let requiredRole = null;
		for(var i=0;i<this.config.extends.length;i++){
			let extent = this.config.extends[i];
			if(extent.id==extensionId && typeof extent.securityRole!='undefined'){
				requiredRole = extent.securityRole;
			}
		}
		return requiredRole;
	}
}

module.exports = ApafPlugin;