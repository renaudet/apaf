/*
 * plugin.js - APAF Custom Datatype Model plugin for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const ApafPlugin = require('../../apafUtil.js');
const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const SECURITY_SERVICE_NAME = 'apaf-security';
const USER_DATATYPE_DATATYPE = 'datatype';
const AUDIT_SERVICE_NAME = 'audit';
const moment = require('moment');
const TIMESTAMP_FORMAT = 'YYYY/MM/DD HH:mm:ss';
const TELEMETRY_SERVICE_NAME = 'telemetry';
const USER_DATATYPE_CREATE_DIMENSION = 'create.user.datatype.count';
const USER_DATATYPE_QUERY_DIMENSION = 'read.user.datatype.count';
const USER_DATATYPE_UPDATE_DIMENSION = 'update.user.datatype.count';
const USER_DATATYPE_DELETE_DIMENSION = 'delete.user.datatype.count';
const TELEMETRY_COLLECT_TIMEOUT = 30;
const CRYPTOGRAPHY_SERVICE_NAME = 'cryptography';
const ENCRYPTABLE_FIELD_TYPES = ['text','password','textarea','richText'];
const ENCRYPTION_KEY_LENGTH = 32;

var plugin = new ApafPlugin();
plugin.createCount = 0;
plugin.queryCount = 0;
plugin.updateCount = 0;
plugin.deleteCount = 0;

function hasRoleAccess(user, role) {
	if (!user) return false;
	if (user.isAdmin) return true;
	if (!role || (typeof role === 'string' && role.trim().length === 0)) return true;
	return Boolean(user.roles && typeof user.roles[role] !== 'undefined');
}

/*
 * Encryption key used for the fields flagged "encrypted".
 * Provided by the environment variable declared in the manifest ("crypto.key" -> $APAF_USER_DATATYPE_KEY).
 * - not set: the default key of the cryptography service is used (this.encryptionKey stays undefined)
 * - set and exactly 32 bytes long: used as is
 * - set but invalid: encryption/decryption is refused - the built-in key is NOT used as a fallback
 */
plugin.initializeEncryptionKey = function(){
	if(typeof this.encryptionKeyInitialized!='undefined'){
		return;
	}
	this.encryptionKeyInitialized = true;
	this.encryptionKey = undefined;
	this.encryptionKeyInvalid = false;
	let configuredKey = this.getConfigValue('crypto.key','string');
	if(typeof configuredKey=='string' && configuredKey.length>0){
		if(Buffer.byteLength(configuredKey,'utf8')==ENCRYPTION_KEY_LENGTH){
			this.encryptionKey = configuredKey;
			this.info('encryption key provided by the environment');
		}else{
			this.encryptionKeyInvalid = true;
			this.error('invalid encryption key provided by the environment: expected '+ENCRYPTION_KEY_LENGTH+' bytes - encrypted fields are unavailable');
		}
	}else{
		this.info('no encryption key provided by the environment - using the default key of the cryptography service');
	}
}

function isEncryptedField(field){
	return field && field.encrypted===true && ENCRYPTABLE_FIELD_TYPES.indexOf(field.type || 'text')>=0;
}

function getEncryptedFields(datatypeRecord){
	let result = [];
	if(datatypeRecord && Array.isArray(datatypeRecord.fields)){
		for(var i=0;i<datatypeRecord.fields.length;i++){
			if(isEncryptedField(datatypeRecord.fields[i])){
				result.push(datatypeRecord.fields[i]);
			}
		}
	}
	return result;
}

/*
 * Validates the "encrypted" option of the fields of a Datatype definition.
 * Returns an error message, or null if the definition is valid.
 */
plugin.validateDatatypeFields = function(datatypeRecord){
	if(!datatypeRecord || !Array.isArray(datatypeRecord.fields)){
		return null;
	}
	for(var i=0;i<datatypeRecord.fields.length;i++){
		let field = datatypeRecord.fields[i];
		if(field && typeof field.encrypted!='undefined'){
			if(typeof field.encrypted!='boolean'){
				return 'field "'+field.name+'": the "encrypted" option must be a boolean';
			}
			if(field.encrypted){
				if(ENCRYPTABLE_FIELD_TYPES.indexOf(field.type || 'text')<0){
					return 'field "'+field.name+'": the "encrypted" option is only supported for the types '+ENCRYPTABLE_FIELD_TYPES.join(', ');
				}
				if(field.isIdField){
					return 'field "'+field.name+'": an encrypted field cannot be an ID field';
				}
				if(field.searchField){
					return 'field "'+field.name+'": an encrypted field cannot be a search field';
				}
			}
		}
	}
	return null;
}

/*
 * Encrypts IN PLACE the values of the encrypted fields of a record before it is stored.
 * Returns an error message, or null on success. On error the record must NOT be stored.
 */
plugin.encryptRecord = function(datatypeRecord,record){
	let fields = getEncryptedFields(datatypeRecord);
	if(fields.length==0 || !record){
		return null;
	}
	this.initializeEncryptionKey();
	if(this.encryptionKeyInvalid){
		return 'encryption key is invalid';
	}
	let cryptoService = this.getService(CRYPTOGRAPHY_SERVICE_NAME);
	for(var i=0;i<fields.length;i++){
		let name = fields[i].name;
		let value = record[name];
		if(typeof value=='string' && value.length>0){
			let encrypted = cryptoService.encrypt(value,this.encryptionKey);
			if(encrypted===null){
				return 'unable to encrypt field "'+name+'"';
			}
			record[name] = encrypted;
		}
	}
	return null;
}

/*
 * Returns a copy of the record where the encrypted fields are decrypted. The given record is not modified.
 * A value that cannot be decrypted is returned as null.
 */
plugin.decryptRecord = function(datatypeRecord,record){
	let fields = getEncryptedFields(datatypeRecord);
	if(fields.length==0 || !record){
		return record;
	}
	this.initializeEncryptionKey();
	let cryptoService = this.getService(CRYPTOGRAPHY_SERVICE_NAME);
	let copy = Object.assign({},record);
	for(var i=0;i<fields.length;i++){
		let name = fields[i].name;
		let value = copy[name];
		if(typeof value=='string' && value.length>0){
			copy[name] = this.encryptionKeyInvalid ? null : cryptoService.decrypt(value,this.encryptionKey);
		}
	}
	return copy;
}

plugin.decryptRecords = function(datatypeRecord,records){
	if(getEncryptedFields(datatypeRecord).length==0 || !Array.isArray(records)){
		return records;
	}
	let result = [];
	for(var i=0;i<records.length;i++){
		result.push(this.decryptRecord(datatypeRecord,records[i]));
	}
	return result;
}

plugin.onConfigurationLoaded = function(){
	this.initializeEncryptionKey();
	setTimeout(function(){ plugin.collectTelemetry(); },10*1000);
}

plugin.collectTelemetry = function(){
	this.trace('->collectTelemetry()');
	let telemetryService = this.getService(TELEMETRY_SERVICE_NAME);
	let telemetryData = {"timestamp": moment().format('YYYY/MM/DD HH:mm:ss'),"count": this.createCount};
	telemetryService.push(USER_DATATYPE_CREATE_DIMENSION,telemetryData);
	telemetryData = {"timestamp": moment().format('YYYY/MM/DD HH:mm:ss'),"count": this.queryCount};
	telemetryService.push(USER_DATATYPE_QUERY_DIMENSION,telemetryData);
	telemetryData = {"timestamp": moment().format('YYYY/MM/DD HH:mm:ss'),"count": this.updateCount};
	telemetryService.push(USER_DATATYPE_UPDATE_DIMENSION,telemetryData);
	telemetryData = {"timestamp": moment().format('YYYY/MM/DD HH:mm:ss'),"count": this.deleteCount};
	telemetryService.push(USER_DATATYPE_DELETE_DIMENSION,telemetryData);
	plugin.trace('<-collectTelemetry()');
	setTimeout(function(){ plugin.collectTelemetry(); },TELEMETRY_COLLECT_TIMEOUT*1000);
}

plugin.queryDatatypeHandler = function(req,res){
	plugin.debug('->queryDatatypeHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.query.user.datatype.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryDatatypeHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			var query = {};
			if(typeof req.body=='object'){
				query = req.body;
			}
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE_DATATYPE,query,function(err,data){
				if(err){
					plugin.debug('<-queryDatatypeHandler()');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-queryDatatypeHandler()');
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}
	});
}

plugin.createDatatypeHandler = function(req,res){
	plugin.debug('->createDatatypeHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.create.user.datatype.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createDatatypeHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			let validationError = plugin.validateDatatypeFields(record);
			if(validationError){
				plugin.debug('<-createDatatypeHandler() - invalid definition');
				res.json({"status": 406,"message": validationError,"data": []});
				return;
			}
			record.createdBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.createRecord(USER_DATATYPE_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-createDatatypeHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-createDatatypeHandler() - success');
					res.json({"status": 200,"message": "created","data": data});
					datatypePlugin.refreshDatatype(data);
				}
			});
		}
	});
}

plugin.updateDatatypeHandler = function(req,res){
	plugin.debug('->updateDatatypeHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.update.user.datatype.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateDatatypeHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let record = req.body;
			let validationError = plugin.validateDatatypeFields(record);
			if(validationError){
				plugin.debug('<-updateDatatypeHandler() - invalid definition');
				res.json({"status": 406,"message": validationError,"data": []});
				return;
			}
			record.lastUpdatedBy = user.login;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.updateRecord(USER_DATATYPE_DATATYPE,record,function(err,data){
				if(err){
					plugin.debug('<-updateDatatypeHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-updateDatatypeHandler() - success');
					res.json({"status": 200,"message": "updated","data": data});
					datatypePlugin.refreshDatatype(data);
				}
			});
		}
	});
}

plugin.deleteDatatypeHandler = function(req,res){
	plugin.debug('->deleteDatatypeHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.delete.user.datatype.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteDatatypeHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.deleteRecord(USER_DATATYPE_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-deleteDatatypeHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-deleteDatatypeHandler() - success');
					res.json({"status": 200,"message": "deleted","data": data.record});
					datatypePlugin.refreshDatatype(data.record,true);
				}
			});
		}
	});
}

plugin.getDatatypeByIdHandler = function(req,res){
	plugin.debug('->getDatatypeByIdHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.get.user.datatype.by.id.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getDatatypeByIdHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let recordId = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.findByPrimaryKey(USER_DATATYPE_DATATYPE,{"id": recordId},function(err,data){
				if(err){
					plugin.debug('<-getDatatypeByIdHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					plugin.debug('<-getDatatypeByIdHandler() - success');
					res.json({"status": 200,"message": "found","data": data});
				}
			});
		}
	});
}
plugin.findDatatypeByPrimaryKeyHandler = plugin.getDatatypeByIdHandler;

plugin.getDatatypeByNameHandler = function(req,res){
	plugin.debug('->getDatatypeByNameHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.get.user.datatype.by.name.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getDatatypeByNameHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypeName = req.query ? req.query.name : null;
			if(!datatypeName || typeof datatypeName !== 'string' || datatypeName.trim().length === 0){
				plugin.debug('<-getDatatypeByNameHandler() - error invalid name');
				res.json({"status": 406,"message": "Not Acceptable","data": "No datatype name found in request"});
			}else{
				let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
				datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatypeName}}},function(err,data){
					if(err){
						plugin.debug('<-getDatatypeByNameHandler() - error');
						res.json({"status": 500,"message": err,"data": []});
					}else{
						if(data && data.length>0){
							let datatypeRecord = data[0];
							plugin.debug('<-getDatatypeByNameHandler() - success');
							res.json({"status": 200,"message": "found","data": datatypeRecord});
						}else{
							plugin.debug('<-getDatatypeByNameHandler() - error');
							res.json({"status": 404,"message": "Not Found"});
						}
					}
				});
			}
		}
	});
}
plugin.findDatatypeByNameHandler = plugin.getDatatypeByNameHandler;

plugin.queryUserDataHandler = function(req,res){
	plugin.debug('->queryUserDataHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.query.user.data.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-queryUserDataHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypeName = req.params.datatypeName;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatypeName}}},function(err,data){
				if(err){
					plugin.debug('<-queryUserDataHandler() - error datatype');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data && data.length>0){
						let datatypeRecord = data[0];
						plugin.trace('a valid datatype "'+datatypeName+'" was found!');
						plugin.trace('datatypeRecord: '+JSON.stringify(datatypeRecord,null,'\t'));
						plugin.trace('User: '+JSON.stringify(user,null,'\t'));
						if(hasRoleAccess(user, datatypeRecord.readRole)){
							let selector = {};
							if(req.body && typeof req.body=='object' && req.body.selector){
								selector = req.body;
							}
							plugin.trace('selector: '+JSON.stringify(selector,null,'\t'));
							datatypePlugin.query(datatypeRecord.name,selector,function(err,data){
								if(err){
									plugin.debug('<-queryUserDataHandler() - error database');
									res.json({"status": 500,"message": err,"data": []});
								}else{
									plugin.queryCount++;
									data = plugin.decryptRecords(datatypeRecord,data);
									let result = [];
									if(datatypeRecord.private && !user.isAdmin){
										for(var i=0;i<data.length;i++){
											let item = data[i];
											if(item['createdBy']==user.login){
												result.push(item);
											}
										}
									}else{
										result = data;
									}
									plugin.debug('<-queryUserDataHandler() - success');
									res.json({"status": 200,"message": "found","data": result});
								}
							});
						}else{
							plugin.debug('<-queryUserDataHandler() - error unauthorized');
							plugin.debug('datatype:');
							plugin.debug(JSON.stringify(datatypeRecord,null,'\t'));
							plugin.debug('user:');
							plugin.debug(JSON.stringify(user,null,'\t'));
							res.json({"status": 401,"message": "unauthorized","data": []});
						}
					}else{
						plugin.debug('<-queryUserDataHandler() - error not found');
						let msg = 'datatype '+datatypeName+' not found';
						res.json({"status": 404,"message": "Not Found","data": msg});
					}
				}
			});
		}
	});
}

plugin.createUserDataHandler = function(req,res){
	plugin.debug('->createUserDataHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.create.user.data.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	let auditService = plugin.getService(AUDIT_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createUserDataHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypeName = req.params.datatypeName;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatypeName}}},function(err,data){
				if(err){
					plugin.debug('<-createUserDataHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data && data.length>0){
						let datatypeRecord = data[0];
						if(hasRoleAccess(user, datatypeRecord.writeRole)){
							let record = req.body;
							record['createdBy'] = user.login;
							record['created'] = moment().format(TIMESTAMP_FORMAT);
							let vetoRaised = false;
							let reason = 'no further data';
							
							if(typeof datatypeRecord.preProcessingCode!='undefined'){
								let preProcess = null;
								let preProcessorContext = {
									"user": user,
									"runtime": plugin.runtime,
									"plugin": plugin,
									"require": require
								}
								try{
									let toEval = 'preProcess = function(ctx,oldRecord,record){\n'+datatypeRecord.preProcessingCode+'\n}';
									eval(toEval);
								}catch(t){
									plugin.error('pre-processor evaluation exception for datatype '+datatypeName);
									plugin.error(t);
								}
								if(preProcess!=null){
									plugin.debug('executing pre-processor function for datatype '+datatypeName);
									try{
										preProcess(preProcessorContext,null,record);
										plugin.debug('pre-processor execution successfull');
									}catch(e){
										plugin.info('veto raised by pre-processor for datatype '+datatypeName);
										vetoRaised = true;
										if(e.message){
											plugin.debug('reason: '+e.message);
											reason = e.message;
										}
									}
								}
							}
							let encryptionError = vetoRaised ? null : plugin.encryptRecord(datatypeRecord,record);
							if(vetoRaised){
								plugin.debug('<-createUserDataHandler() - veto raised');
								let message = 'veto raised by pre-processor. reason: '+reason;
								res.json({"status": 500,"message": message,"data": []});
							}else if(encryptionError){
								plugin.debug('<-createUserDataHandler() - encryption error');
								res.json({"status": 500,"message": encryptionError,"data": []});
							}else{
								datatypePlugin.createRecord(datatypeRecord.name,record,function(err,storedData){
									if(err){
										plugin.debug('<-createUserDataHandler() - error');
										res.json({"status": 500,"message": err,"data": []});
									}else{
										plugin.createCount++;
										// the audit trail receives the stored (encrypted) version of the record - never the clear values
										if(datatypeRecord.auditEnabled){
											try{
												auditService.createAuditRecord(datatypeRecord,storedData.id,user.login,'created',storedData);
											}catch(e){}
										}
										let data = plugin.decryptRecord(datatypeRecord,storedData);
										plugin.debug('<-createUserDataHandler() - success');
										res.json({"status": 200,"message": "created","data": data});
										if(typeof datatypeRecord.postProcessingCode!='undefined'){
											let postProcess = null;
											let postProcessorContext = {
												"user": user,
												"runtime": plugin.runtime,
												"plugin": plugin,
												"require": require
											}
											try{
												let toEval = 'postProcess = function(ctx,record){\n'+datatypeRecord.postProcessingCode+'\n}';
												eval(toEval);
											}catch(t){
												plugin.error('post-processor evaluation exception for datatype '+datatypeName);
												plugin.error(t);
											}
											if(postProcess!=null){
												plugin.debug('executing post-processor function for datatype '+datatypeName);
												try{
													postProcess(postProcessorContext,data);
													plugin.debug('post-processor execution successfull');
												}catch(e){
													plugin.error('post-processor execution failed');
													if(e.message){
														plugin.error('reason: '+e.message);
													}
												}
											}
										}
									}
								});
							}
						}else{
							plugin.debug('<-createUserDataHandler() - error');
							res.json({"status": 401,"message": "unauthorized","data": []});
						}
					}else{
						plugin.debug('<-createUserDataHandler() - error');
						let msg = 'datatype '+datatypeName+' not found';
						res.json({"status": 404,"message": "Not Found","data": msg});
					}
				}
			});
		}
	});
}

plugin.updateUserDataHandler = function(req,res){
	plugin.debug('->updateUserDataHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.update.user.data.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	let auditService = plugin.getService(AUDIT_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-updateUserDataHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypeName = req.params.datatypeName;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatypeName}}},function(err,data){
				if(err){
					plugin.debug('<-updateUserDataHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data && data.length>0){
						let datatypeRecord = data[0];
						if(hasRoleAccess(user, datatypeRecord.writeRole)){
							let record = req.body;
							record['lastUpdatedBy'] = user.login;
							record['updated'] = moment().format(TIMESTAMP_FORMAT);
							let vetoRaised = false;
							let reason = 'no further data';
							
							datatypePlugin.findByPrimaryKey(datatypeRecord.name,{"id": record.id},function(err,oldRecord){
								if(err){
									plugin.debug('<-updateUserDataHandler() - error database');
									res.json({"status": 500,"message": err,"data": []});
								}else{
									if(oldRecord && oldRecord['_rev']==record['_rev']){
										
										if(typeof datatypeRecord.preProcessingCode!='undefined'){
											let preProcess = null;
											let preProcessorContext = {
												"user": user,
												"runtime": plugin.runtime,
												"plugin": plugin,
												"require": require
											}
											try{
												let toEval = 'preProcess = function(ctx,oldRecord,record){\n'+datatypeRecord.preProcessingCode+'\n}';
												eval(toEval);
											}catch(t){
												plugin.error('pre-processor evaluation exception for datatype '+datatypeName);
												plugin.error(t);
											}
											if(preProcess!=null){
												plugin.debug('executing pre-processor function for datatype '+datatypeName);
												try{
													preProcess(preProcessorContext,plugin.decryptRecord(datatypeRecord,oldRecord),record);
													plugin.debug('pre-processor execution successfull');
												}catch(e){
													plugin.info('veto raised by pre-processor for datatype '+datatypeName);
													vetoRaised = true;
													if(e.message){
														plugin.debug('reason: '+e.message);
														reason = e.message;
													}
												}
											}
										}
										let encryptionError = vetoRaised ? null : plugin.encryptRecord(datatypeRecord,record);
										if(vetoRaised){
											plugin.debug('<-updateUserDataHandler() - veto raised');
											let message = 'veto raised by pre-processor. reason: '+reason;
											res.json({"status": 500,"message": message,"data": []});
										}else if(encryptionError){
											plugin.debug('<-updateUserDataHandler() - encryption error');
											res.json({"status": 500,"message": encryptionError,"data": []});
										}else{
											datatypePlugin.updateRecord(datatypeRecord.name,record,function(err,storedData){
												if(err){
													plugin.debug('<-updateUserDataHandler() - error');
													res.json({"status": 500,"message": err,"data": []});
												}else{
													plugin.updateCount++;
													// the audit trail receives the stored (encrypted) version of the record - never the clear values
													if(datatypeRecord.auditEnabled){
														try{
															auditService.createAuditRecord(datatypeRecord,req.body.id,user.login,'updated',storedData);
														}catch(e){}
													}
													let data = plugin.decryptRecord(datatypeRecord,storedData);
													plugin.debug('<-updateUserDataHandler() - success');
													res.json({"status": 200,"message": "updated","data": data});
													if(typeof datatypeRecord.postProcessingCode!='undefined'){
														let postProcess = null;
														let postProcessorContext = {
															"user": user,
															"runtime": plugin.runtime,
															"plugin": plugin,
															"require": require
														}
														try{
															let toEval = 'postProcess = function(ctx,record){\n'+datatypeRecord.postProcessingCode+'\n}';
															eval(toEval);
														}catch(t){
															plugin.error('post-processor evaluation exception for datatype '+datatypeName);
															plugin.error(t);
														}
														if(postProcess!=null){
															plugin.debug('executing post-processor function for datatype '+datatypeName);
															try{
																postProcess(postProcessorContext,data);
																plugin.debug('post-processor execution successfull');
															}catch(e){
																plugin.error('post-processor execution failed');
																if(e.message){
																	plugin.error('reason: '+e.message);
																}
															}
														}
													}
												}
											});
										}
										
										
									}else{
										plugin.debug('<-updateUserDataHandler() - error concurrent access');
										res.json({"status": 500,"message": "Stale data - please refresh and retry","data": []});
									}
								}
							});
						}else{
							plugin.debug('<-updateUserDataHandler() - error');
							res.json({"status": 401,"message": "unauthorized","data": []});
						}
					}else{
						plugin.debug('<-updateUserDataHandler() - error');
						let msg = 'datatype '+datatypeName+' not found';
						res.json({"status": 404,"message": "Not Found","data": msg});
					}
				}
			});
		}
	});
}

plugin.deleteUserDataHandler = function(req,res){
	plugin.debug('->deleteUserDataHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.delete.user.data.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	let auditService = plugin.getService(AUDIT_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteUserDataHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypeName = req.params.datatypeName;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatypeName}}},function(err,data){
				if(err){
					plugin.debug('<-deleteUserDataHandler() - error');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data && data.length>0){
						let datatypeRecord = data[0];
						if(hasRoleAccess(user, datatypeRecord.deleteRole)){
							let id = req.params.id;
							datatypePlugin.deleteRecord(datatypeRecord.name,{"id": id},function(err,data){
								if(err){
									plugin.debug('<-deleteUserDataHandler() - error');
									res.json({"status": 500,"message": err,"data": []});
								}else{
									plugin.deleteCount++;
									if(datatypeRecord.auditEnabled){
										try{
											auditService.createAuditRecord(datatypeRecord,id,user.login,'deleted');
										}catch(e){}
									}
									plugin.debug('<-deleteUserDataHandler() - success');
									res.json({"status": 200,"message": "updated","data": data});
								}
							});
						}else{
							plugin.debug('<-deleteUserDataHandler() - error');
							res.json({"status": 401,"message": "unauthorized","data": []});
						}
					}else{
						plugin.debug('<-deleteUserDataHandler() - error');
						let msg = 'datatype '+datatypeName+' not found';
						res.json({"status": 404,"message": "Not Found","data": msg});
					}
				}
			});
		}
	});
}

plugin.getUserDataByIdHandler = function(req,res){
	plugin.debug('->getUserDataByIdHandler()');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.datatype.get.user.data.by.id.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getUserDataByIdHandler() - error');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let datatypeName = req.params.datatypeName;
			let id = req.params.id;
			let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
			datatypePlugin.query(USER_DATATYPE_DATATYPE,{"selector": {"name": {"$eq": datatypeName}}},function(err,data){
				if(err){
					plugin.debug('<-getUserDataByIdHandler() - error datatype');
					res.json({"status": 500,"message": err,"data": []});
				}else{
					if(data && data.length>0){
						let datatypeRecord = data[0];
						if(hasRoleAccess(user, datatypeRecord.readRole)){
							datatypePlugin.findByPrimaryKey(datatypeRecord.name,{"id": id},function(err,record){
								if(err){
									plugin.debug('<-getUserDataByIdHandler() - error database');
									res.json({"status": 500,"message": err,"data": []});
								}else{
									if(!datatypeRecord.private || user.isAdmin || record['createdBy']==user.login){
										plugin.debug('<-getUserDataByIdHandler() - success');
										res.json({"status": 200,"message": "found","data": plugin.decryptRecord(datatypeRecord,record)});
									}else{
										plugin.debug('<-getUserDataByIdHandler() - private');
										res.json({"status": 404,"message": "Not Found","data": {}});
									}
								}
							});
						}else{
							plugin.debug('<-getUserDataByIdHandler() - error unauthorized');
							plugin.debug('datatype:');
							plugin.debug(JSON.stringify(datatypeRecord,null,'\t'));
							plugin.debug('user:');
							plugin.debug(JSON.stringify(user,null,'\t'));
							res.json({"status": 401,"message": "unauthorized","data": []});
						}
					}else{
						plugin.debug('<-getUserDataByIdHandler() - error not found');
						let msg = 'datatype '+datatypeName+' not found';
						res.json({"status": 404,"message": "Not Found","data": msg});
					}
				}
			});
		}
	});
}

/*
 * Programmatic query for User Datatype records — no HTTP/security layer.
 * Intended for server-side callers (e.g. APL Micro-Services built-ins) that
 * are already running inside an authenticated request context.
 *
 * @param {string}   datatypeName - technical name of the User Datatype
 * @param {object}   query        - CouchDB Mango selector wrapper, e.g. { selector: { ... } }
 * @param {function} callback     - node-style callback(err, data[])
 */
plugin.queryUserData = function(datatypeName, query, callback) {
	plugin.debug('->queryUserData(' + datatypeName + ')');
	let datatypePlugin = plugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
	datatypePlugin.query(USER_DATATYPE_DATATYPE, {"selector": {"name": {"$eq": datatypeName}}}, function(err, data) {
		if(err) {
			plugin.debug('<-queryUserData() - error resolving datatype');
			callback(err, null);
		} else {
			if(data && data.length > 0) {
				let datatypeRecord = data[0];
				plugin.debug('<-queryUserData() - datatype resolved, querying records');
				datatypePlugin.query(datatypeRecord.name, query, function(err, records) {
					if(err) {
						plugin.debug('<-queryUserData() - error querying records');
						callback(err, null);
					} else {
						plugin.debug('<-queryUserData() - success, ' + (records ? records.length : 0) + ' record(s)');
						callback(null, plugin.decryptRecords(datatypeRecord, records || []));
					}
				});
			} else {
				let msg = 'datatype "' + datatypeName + '" not found';
				plugin.debug('<-queryUserData() - ' + msg);
				callback(msg, null);
			}
		}
	});
};

module.exports = plugin;