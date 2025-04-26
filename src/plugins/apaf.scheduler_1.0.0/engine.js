/*
 * engine.js - APAF Scheduler engine runtime
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const DATATYPE_PLUGIN_ID = 'apaf.datatype';
const WORKFLOW_PLUGIN_ID = 'apaf.workflow';
const JOB_SERVICE_NAME = 'jobs';
const SECURITY_SERVICE_NAME = 'apaf-security';
const USER_DATATYPE_NAME = 'user';
const SCHEDULER_DATATYPE_NAME = 'scheduler';
const FRAGMENT_DATATYPE_NAME = 'fragment';
const DATE_TIME_FORMAT = 'YYYY/MM/DD HH:mm:ss';
const TIMESTAMP_FORMAT = 'HH:mm:ss';
const RUNTIME_PROPERTIES_SERVICE_NAME = 'properties';
const TICK_TIMEOUT_PROPERTY_NAME = 'scheduler.tick.timeout';

var xeval = eval;
 
class SchedulerEngine {
	schedulerPlugin = null;
	constructor(plugin){
		this.schedulerPlugin = plugin;	
	}
	info(msg){
		this.schedulerPlugin.info(msg);
	}
	debug(msg){
		this.schedulerPlugin.debug(msg);
	}
	trace(msg){
		this.schedulerPlugin.trace(msg);
	}
	error(msg){
		this.schedulerPlugin.error(msg);
	}
	getTickValue(){
	    let propService = this.schedulerPlugin.getService(RUNTIME_PROPERTIES_SERVICE_NAME);
	    return propService.getProperty(TICK_TIMEOUT_PROPERTY_NAME);
	}
	start(){
		this.info('SchedulerEngine starting...');
		let datatypePlugin = this.schedulerPlugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		let query = {"selector": {"$and": [{"type": {"$eq": "startup"}},{"active": {"$eq": true}}]}};
		let engine = this;
		datatypePlugin.query(SCHEDULER_DATATYPE_NAME,query,function(err,data){
			if(err){
				engine.error('unable to load records from the scheduler table');
				engine.error(err);
			}else{
				if(data.length>0){
					engine.executeStartupTasks(data);
				}else{
					engine.checkLoop();
				}
			}
		});
	}
	executeStartupTasks(tasks){
		for(var i=0;i<tasks.length;i++){
			let task = tasks[i];
			this.info('found active startup rule "'+task.name+'"');
			this.executeTask(task);
		}
		this.checkLoop();
	}
	executeTask(task){
		this.debug('->executeTask()');
		this.trace('task: '+task.name);
		let engine = this;
		let datatypePlugin = engine.schedulerPlugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		datatypePlugin.findByPrimaryKey(USER_DATATYPE_NAME,{"id": task.runAs},function(err,user){
			if(err){
				engine.debug('<-executeTask() - error owner not found');
			}else{
				let securityEngine = engine.schedulerPlugin.getService(SECURITY_SERVICE_NAME);
				securityEngine.loadUserRoles(user,function(updatedUser){
					if(typeof task.servlet!='undefined' && task.servlet.length>0){
						engine.executeSnippet(task.servlet,updatedUser,function(){
							task.lastExecuted = moment();
							datatypePlugin.updateRecord(SCHEDULER_DATATYPE_NAME,task,function(err,data){
								if(err){
									engine.error('an error occured updating task "'+task.name+'": '+err);
								}
							});
						});
					}
					if(typeof task.workflow!='undefined' && task.workflow.length>0){
						task.lastExecuted = moment();
						engine.debug('executing workflow '+task.workflow+'...');
						datatypePlugin.updateRecord(SCHEDULER_DATATYPE_NAME,task,function(err,data){
							if(err){
								engine.error('an error occured updating task "'+task.name+'": '+err);
							}else{
								engine.executeWorkflow(task.workflow,updatedUser,function(){
									engine.debug('workflow '+task.workflow+' got launched / executed!');
								});
							}
						});
					}
					engine.debug('<-executeTask()');
				});
			}
		});
	}
	executeSnippet(snippetId,asUser,then){
		this.debug('->executeSnippet()');
		this.trace('snippetId: '+snippetId);
		let datatypePlugin = this.schedulerPlugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		let engine = this;
		datatypePlugin.findByPrimaryKey(FRAGMENT_DATATYPE_NAME,{"id": snippetId},function(err,fragment){
			if(err){
				engine.error('an error occured loading the code snippet: '+err);
			}else{
				engine.info('evaluating code snippet "'+fragment.name+' v'+fragment.version+'" as User '+asUser.login);
				let moduleSrc = 'var executeFunction = function(ctx){'+fragment.source+'}';
				xeval(moduleSrc);
				let jobService = engine.schedulerPlugin.getService(JOB_SERVICE_NAME);
				let job = jobService.createJob(asUser.login,fragment.name+' v'+fragment.version+'_'+moment().format(TIMESTAMP_FORMAT));
				engine.info('evaluation successfull - job ID# is '+job.id);
				var context = {};
				context.id = job.id;
				context.user = asUser;
				context.info = function(msg){
					engine.info('from job #'+this.id+' '+msg);
				}
				context.debug = function(msg){
					engine.debug('from job #'+this.id+' '+msg);
				}
				context.trace = function(msg){
					engine.trace('from job #'+this.id+' '+msg);
				}
				context.error = function(msg){
					engine.error('from job #'+this.id+' '+msg);
				}
				context.setProgress = function(percent){
					jobService.updateJob({"id": this.id,"progress": percent});
				}
				context.checkStatus = function(){
					let theJob = jobService.getJob(this.id);
					return theJob.status == 'ongoing';
				}
				executeFunction(context);
			}
			engine.debug('<-executeSnippet()');
			then();
		});
	}
	executeWorkflow(workflowId,asUser,then){
		this.debug('->executeWorkflow()');
		this.trace('workflowId: '+workflowId);
		this.trace('asUser: '+asUser.login);
		let engine = this;
		let workflowPlugin = this.schedulerPlugin.runtime.getPlugin(WORKFLOW_PLUGIN_ID);
		let query = {"selector": {"id": {"$eq": workflowId}}};
		engine.info('executing workflow #'+workflowId+' as User '+asUser.login);
		workflowPlugin.queryAndExecuteWorkflow(query,asUser,{"status": "pending"},function(){
			engine.debug('<-executeWorkflow() workflowId: '+workflowId);
			then();
		});
	}
	checkLoop(){
		this.debug('->checkLoop()');
		let datatypePlugin = this.schedulerPlugin.runtime.getPlugin(DATATYPE_PLUGIN_ID);
		let query = {"selector": {"$and": [ {"$or": [{"type": {"$eq": "recurrent"}},{"type": {"$eq": "fixed"}}]},{"active": {"$eq": true}}]}};
		let engine = this;
		datatypePlugin.query(SCHEDULER_DATATYPE_NAME,query,function(err,tasks){
			if(err){
				engine.error('unable to load records from the scheduler table');
				engine.error(err);
			}else{
				engine.debug('retrieved '+tasks.length+' rules from the datasource');
				if(tasks.length>0){
					var recurrentTasks = [];
					var fixedTimeTasks = [];
					var now = moment();
					for(var i=0;i<tasks.length;i++){
						var task = tasks[i];
						if('recurrent'==task.type){
							var idleTime = task.lastExecuted?now.diff(task.lastExecuted):(task.delay*60000)+1;
							if(idleTime>=(task.delay*60000)){
								recurrentTasks.push(task);
							}
						}
						if('fixed'==task.type){
							var taskMoment = null;
							if(typeof task.date!='undefined'){
								taskMoment = moment(task.date+' '+task.time,DATE_TIME_FORMAT);
							}else{
								var dateFormatted = now.format('YYYY/MM/DD');
								taskMoment = moment(dateFormatted+' '+task.time,DATE_TIME_FORMAT);
							}
							if(now.isAfter(taskMoment) && now.diff(taskMoment)<engine.getTickValue()){
								fixedTimeTasks.push(task);
							}
						}
					}
					
					if(recurrentTasks.length>0){
						engine.debug('found '+recurrentTasks.length+' recurrent tasks ready to execute');
						for(var i=0;i<recurrentTasks.length;i++){
							let task = recurrentTasks[i];
							engine.executeTask(task);
						}
					}
					if(fixedTimeTasks.length>0){
						engine.debug('found '+fixedTimeTasks.length+' fixed-time tasks ready to execute');
						for(var i=0;i<fixedTimeTasks.length;i++){
							let task = fixedTimeTasks[i];
							engine.executeTask(task);
						}
					}
					
					
				}
			}
		});
		setTimeout(function(){ engine.checkLoop(); },engine.getTickValue());
	}
}

module.exports = SchedulerEngine;