/*
 * plugin.js - Menu handler plugin for APAF
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';


var plugin = new ApafPlugin();
plugin.globalMenu = [];
plugin.globalMenuById = {};

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
	if('apaf.menu.provider'==extensionPointConfig.point && extensionPointConfig.menu){
		this.debug('plugin-in new menu "'+extensionPointConfig.menu.id+'" from plugin '+extenderId);
		this.globalMenu.push(extensionPointConfig);
		this.globalMenuById[extensionPointConfig.menu.id] = extensionPointConfig;
		extensionPointConfig.items = [];
	}
	if('apaf.menu.item.provider'==extensionPointConfig.point && extensionPointConfig.item){
		this.debug('plugin-in new menu item "'+extensionPointConfig.item.id+'" to menu "'+extensionPointConfig.menu+'" from plugin '+extenderId);
		let targetMenu = this.globalMenuById[extensionPointConfig.menu];
		if(typeof targetMenu!='undefined'){
			targetMenu.items.push(extensionPointConfig);
		}else{
			this.info('WARNING: target menu "'+extensionPointConfig.menu+'" for menu item "'+extensionPointConfig.item.id+'" not found. Assume it is a placeholder');
			targetMenu = {"id": extensionPointConfig.menu,"items": [],"menu": {"id": extensionPointConfig.menu,"label": "","type": "placeholder"}};
			this.globalMenu.push(targetMenu);
			this.globalMenuById[extensionPointConfig.menu] = targetMenu;
			targetMenu.items.push(extensionPointConfig);
		}
	}
}

plugin.getGlobalMenuHandler = function(req,res){
	plugin.debug('->getGlobalMenuHandler()');
	//res.set('Content-Type','application/json');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,null,function(err,user){
		if(err){
			plugin.debug('<-getGlobalMenuHandler(500)');
			res.json({"status": 500,"message": "error looking up for the user's session'","data": err});
		}else{
			let globalMenu = [];
			for(var i=0;i<plugin.globalMenu.length;i++){
				let menuWrapper = plugin.globalMenu[i];
				if(typeof menuWrapper.securityRole=='undefined' || 
				   menuWrapper.securityRole.length==0 ||
				   user.isAdmin ||
				   typeof user.roles[menuWrapper.securityRole]!='undefined'){
					//console.log(menuWrapper.id);
					let menu = Object.assign({},menuWrapper.menu);
					menu.items = [];
					globalMenu.push(menu);
					for(var j=0;j<menuWrapper.items.length;j++){
						let itemWrapper = menuWrapper.items[j];
						if(typeof itemWrapper.securityRole=='undefined' ||
						   itemWrapper.securityRole.length==0 ||
						   user.isAdmin ||
						   typeof user.roles[itemWrapper.securityRole]!='undefined'){
							//console.log(itemWrapper);
							let item = Object.assign({},itemWrapper.item);
							menu.items.push(item);
						}
					}
				}
			}
			plugin.debug('<-getGlobalMenuHandler(200)');
			res.json({"status": 200,"message": "ok","data": globalMenu});
		}
	});
}

module.exports = plugin;