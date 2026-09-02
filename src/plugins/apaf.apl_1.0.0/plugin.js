/*
 * plugin.js - APAF Programming Language execution service
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const ApafPlugin = require('../../apafUtil.js');
const COMPILER_SERVICE_NAME = 'compiler';
const APL_GRAMMAR = require('./apl_v1.0.0.json');
const DEFAULT_NAMESPACE = 'main';

/*
 * EuReader - a fluent navigation helper for ExecutionUnit trees.
 *
 * Structure reminder:
 *   - Named rule node  : eu.name = ruleName, eu.next = single EU (OR result) or array (AND result)
 *   - AND node         : eu.name = 'AND',    eu.next = ExecutionUnit[]
 *   - Token node       : eu.name = tokenType, eu.token.value = lexical value
 *
 * Named shortcuts:
 *   r(eu)               wrap an EU in a reader
 *   .eu                 unwrap back to the raw ExecutionUnit
 *   .inner()            eu.next  (first child of a named/OR node, returns EuReader)
 *   .innerName()        eu.next.name
 *   .child(n)           eu.next.next[n]  (n-th element of the AND array, returns EuReader)
 *   .childName(n)       eu.next.next[n].name
 *   .childValue(n)      eu.next.next[n].token.value  (lexical value of token child n)
 *   .item(n)            eu.next[n]  (when eu IS the AND node, returns EuReader)
 *   .itemName(n)        eu.next[n].name
 *   .itemValue(n)       eu.next[n].value
 *   .firstChild()       eu.next[0]  (first element of an AND array, returns EuReader)
 */
class EuReader {
	constructor(eu){ this.eu = eu; }
	inner()       { return new EuReader(this.eu.next); }
	innerName()   { return this.eu.next ? this.eu.next.name : null; }
	child(n)      { return new EuReader(this.eu.next.next[n]); }
	childName(n)  { return this.eu.next.next[n].name; }
	childValue(n) { return this.eu.next.next[n].value; }
	item(n)       { return new EuReader(this.eu.next[n]); }
	itemName(n)   { return this.eu.next[n].name; }
	itemValue(n)  { return this.eu.next[n].value; }
	firstChild()  { return new EuReader(this.eu.next[0]); }
}

function r(eu){ return new EuReader(eu); }

function extractSignedNumberValue(signedNumberEu){
	let eu = r(signedNumberEu);
	if('AND'==eu.innerName()){
		return -1 * Number(eu.child(1).eu.value);
	}else{
		return Number(eu.inner().eu.value);
	}
}

function extractArgumentList(argListEu){
	let argsEus = [];
	if('ARGUMENT_LIST'==argListEu.name){
		let eu = r(argListEu);
		if('AND'==eu.innerName()){
			argsEus.push(extractArgumentList(eu.child(0).eu)[0]);
			let nextEus = extractArgumentList(eu.child(2).eu);
			for(var i=0;i<nextEus.length;i++){ argsEus.push(nextEus[i]); }
		}else{
			let nextEus = extractArgumentList(eu.inner().eu);
			for(var i=0;i<nextEus.length;i++){ argsEus.push(nextEus[i]); }
		}
	}
	if('EXPRESSION'==argListEu.name){ argsEus.push(argListEu); }
	return argsEus;
}

function extractArgumentNameList(paramList){
	let argNames = [];
	if('PARAMETER_LIST'==paramList.name){
		let eu = r(paramList);
		if('AND'==eu.innerName()){
			argNames.push(extractArgumentNameList(eu.child(0).eu)[0]);
			let nextEus = extractArgumentNameList(eu.child(2).eu);
			for(var i=0;i<nextEus.length;i++){ argNames.push(nextEus[i]); }
		}else{
			let nextEus = extractArgumentNameList(eu.inner().eu);
			for(var i=0;i<nextEus.length;i++){ argNames.push(nextEus[i]); }
		}
	}
	if('IDENTIFIER'==paramList.name){ argNames.push(paramList.value); }
	return argNames;
}

/*
 * EvaluationTree — expression evaluator.
 * Delegates logging to the AplExecutionEnginePlugin instance via pluginRef.
 */
class EvaluationTree {
	left = null;
	right = null;
	engine = null;
	isLeaf = false;
	value = null;
	operator = null;
	expression = null;
	pluginRef = null;
	constructor(expression, engine, pluginRef){
		this.engine = engine;
		this.pluginRef = pluginRef;
		this.buildTree(expression);
	}
	buildTree(expression){
		let eu = r(expression);
		if('CONDITION'==expression.name && expression.next && 'AND'==eu.innerName()){
			let subs = expression.next.next;
			if('NOT'==subs[0].name){
				this.operator = '!';
				this.right = new EvaluationTree(subs[1], this.engine, this.pluginRef);
			}else if(subs[1] && (subs[1].name=='LOGIC_OPERATOR')){
				this.operator = subs[1].value;
				this.left  = new EvaluationTree(subs[0], this.engine, this.pluginRef);
				this.right = new EvaluationTree(subs[2], this.engine, this.pluginRef);
			}else if(subs.length>=4 && subs[3].name=='LOGIC_OPERATOR'){
				this.operator = subs[3].value;
				this.left  = new EvaluationTree(subs[1], this.engine, this.pluginRef);
				this.right = new EvaluationTree(subs[4], this.engine, this.pluginRef);
			}else{
				this.buildTree(subs[1]);
			}
		}else if('EXPRESSION'==expression.name && expression.next && 'AND'==eu.innerName()){
			let subs = expression.next.next;
			if(subs[1] && (subs[1].name=='OPERATOR')){
				this.operator = subs[1].value;
				this.left  = new EvaluationTree(subs[0], this.engine, this.pluginRef);
				this.right = new EvaluationTree(subs[2], this.engine, this.pluginRef);
			}else if(subs.length>=4 && subs[3].name=='OPERATOR'){
				this.operator = subs[3].value;
				this.left  = new EvaluationTree(subs[1], this.engine, this.pluginRef);
				this.right = new EvaluationTree(subs[4], this.engine, this.pluginRef);
			}else{
				this.buildTree(subs[1]);
			}
		}else{
			this.isLeaf = true;
			this.expression = expression;
		}
	}
	_resolveFunctionCall(euPtr){
		let callEu = r(euPtr).inner();
		let functionName = callEu.itemValue(0);
		let args = [];
		let argListEu = callEu.item(2);
		if(argListEu.eu.next){
			let rawArgs = extractArgumentList(argListEu.item(0).eu);
			let vals = [];
			for(var i=0;i<rawArgs.length;i++){
				let evalTree = new EvaluationTree(rawArgs[i], this.engine, this.pluginRef);
				vals.push(evalTree.evaluate());
			}
			args = vals;
		}
		return this.engine.cal(functionName, args);
	}
	_resolveArrayAccess(euPtr){
		let accessEu = r(euPtr).inner();
		let arrayName = accessEu.itemValue(0);
		let indexExpression = accessEu.item(2).eu;
		let indexTree = new EvaluationTree(indexExpression, this.engine, this.pluginRef);
		let index = Math.floor(indexTree.evaluate());
		let array = this.engine.rcl(arrayName);
		if(Array.isArray(array)){ return array[index]; }
		this.engine.halt(arrayName+' is not an array');
		return 0;
	}
	_resolvePropertyAccess(euPtr){
		let accessEu = r(euPtr).inner();
		let objName  = accessEu.itemValue(0);
		let propName = accessEu.itemValue(2);
		let obj = this.engine.rcl(objName);
		if(obj===null || obj===undefined){ this.engine.halt(objName+' is null or undefined'); return undefined; }
		if('length'==propName && Array.isArray(obj)){ return obj.length; }
		if(typeof obj=='object'){ return obj[propName]; }
		this.engine.halt(objName+' is not an object');
		return undefined;
	}
	evaluate(delegatedValue, operator){
		if(this.isLeaf){
			let expr = this.expression;
			let eu = r(expr);
			if('IDENTIFIER'==expr.name)          { this.value = this.engine.rcl(expr.value); }
			else if('SIGNED_NUMBER'==expr.name)  { this.value = extractSignedNumberValue(expr); }
			else if('BOOLEAN_VALUE'==expr.name)  { this.value = (eu.inner().eu.value === 'true'); }
			else if('NULL_LITERAL'==expr.name)   { this.value = null; }
			else if('FUNCTION_CALL'==expr.name)  { this.value = expr; }
			else if('ARRAY_ACCESS'==expr.name)   { this.value = this._resolveArrayAccess(expr); }
			else if('PROPERTY_ACCESS'==expr.name){ this.value = this._resolvePropertyAccess(expr); }
			else if('STRING'==expr.name)         { this.value = eu.inner().eu.value.replace(/"/g,''); }
			else if(expr.next){
				let inner = eu.inner().eu;
				if     ('FUNCTION_CALL'==inner.name)  { this.value = inner; }
				else if('ARRAY_ACCESS'==inner.name)   { this.value = this._resolveArrayAccess(inner); }
				else if('PROPERTY_ACCESS'==inner.name){ this.value = this._resolvePropertyAccess(inner); }
				else if('BOOLEAN_VALUE'==inner.name)  { this.value = (r(inner).inner().eu.value === 'true'); }
				else if('NULL_LITERAL'==inner.name)   { this.value = null; }
				else if('IDENTIFIER'==inner.name)     { this.value = this.engine.rcl(inner.value); }
				else if('SIGNED_NUMBER'==inner.name)  { this.value = extractSignedNumberValue(inner); }
				else if('STRING'==inner.name)         { this.value = r(inner).inner().eu.value.replace(/"/g,''); }
			}
			if(this.value && typeof this.value=='object' && this.value.name=='FUNCTION_CALL'){
				this.value = this._resolveFunctionCall(this.value);
			}
			if(delegatedValue && operator){
				if('*'==operator) return delegatedValue * this.value;
				if('/'==operator){
					if(this.value==0){ this.engine.halt('division by zero'); return 0; }
					return delegatedValue / this.value;
				}
			}
			return this.value;
		}else{
			if('!'==this.operator){ return !this.right.evaluate(); }
			let leftValue = this.left.evaluate();
			if(delegatedValue && operator){
				if('*'==operator) leftValue = delegatedValue * leftValue;
				if('/'==operator) leftValue = delegatedValue / leftValue;
			}
			if('+'==this.operator || '-'==this.operator){
				let rightValue = this.right.evaluate();
				return '+'==this.operator ? leftValue + rightValue : leftValue - rightValue;
			}
			if('<'==this.operator)  return leftValue <  this.right.evaluate();
			if('>'==this.operator)  return leftValue >  this.right.evaluate();
			if('=='==this.operator) return leftValue == this.right.evaluate();
			if('!='==this.operator) return leftValue != this.right.evaluate();
			if('>='==this.operator) return leftValue >= this.right.evaluate();
			if('<='==this.operator) return leftValue <= this.right.evaluate();
			if('||'==this.operator) return leftValue || this.right.evaluate();
			if('&&'==this.operator) return leftValue && this.right.evaluate();
			return this.right.evaluate(leftValue, this.operator);
		}
	}
}

/*
 * AplExecutionEnginePlugin — language runtime for APL grammar.
 *
 * This class is NOT a NPA Plugin itself; it is instantiated fresh for each
 * execute() call by the apaf.apl plugin service. Logging is delegated to the
 * apaf.apl plugin instance via the _logRef injected at construction time.
 */
class AplExecutionEnginePlugin {
	grammar = {
		"name": "APL",
		"version": "1.0.0"
	};
	engine = null;
	executionUnitPtr = {};
	testImbricationLevel = 0;
	canProceed = true;
	_logRef = null;   // { debug, trace, info, error, warning, canLog } — NPA plugin methods

	constructor(logRef){
		this._logRef = logRef || { debug(){}, trace(){}, info(){}, error(){}, warning(){}, canLog(){ return false; } };
	}
	debug(txt)  { this._logRef.debug(txt); }
	trace(txt)  { this._logRef.trace(txt); }
	info(txt)   { this._logRef.info(txt); }
	error(txt)  { this._logRef.error(txt); }
	warning(txt){ this._logRef.warning(txt); }
	canLog(l)   { return this._logRef.canLog(l); }

	getNextInstruction(namespace=DEFAULT_NAMESPACE){
		this.debug('->AplExecutionEnginePlugin#getNextInstruction("'+namespace+'")');
		if(this.canProceed && this.executionUnitPtr[namespace]){
			let ptr = this.executionUnitPtr[namespace];
			if(ptr.name=='INSTRUCTION_SEQUENCE'){
				let eu = r(ptr);
				if('AND'==eu.innerName()){
					let instruction = eu.child(0).eu;
					this.executionUnitPtr[namespace] = eu.child(1).eu;
					this.debug('<-AplExecutionEnginePlugin#getNextInstruction() - instruction type: '+r(instruction).innerName());
					return r(instruction).inner().eu;
				}
				if('INSTRUCTION'==eu.innerName()){
					let instruction = eu.inner().eu;
					this.executionUnitPtr[namespace] = null;
					this.debug('<-AplExecutionEnginePlugin#getNextInstruction() - instruction type: '+r(instruction).innerName());
					return r(instruction).inner().eu;
				}
			}
		}
		this.debug('<-AplExecutionEnginePlugin#getNextInstruction() - end of file reached');
		return null;
	}
	processVariableDeclaration(instruction){
		this.debug('->AplExecutionEnginePlugin#processVariableDeclaration()');
		let eu = r(instruction);
		let variableName = eu.itemValue(1);
		this.trace('target variable name: '+variableName);
		if('ARRAY_START'==eu.itemName(3)){
			let sizeExpression = eu.item(4).eu;
			let sizeTree = new EvaluationTree(sizeExpression, this.engine, this);
			let arraySize = Math.floor(sizeTree.evaluate());
			this.engine.sto(variableName, new Array(arraySize).fill(0));
		}else if('AFFECTATION_SIGN'==eu.itemName(2)){
			let expression = eu.item(3).eu;
			let evaluationTree = new EvaluationTree(expression, this.engine, this);
			this.engine.sto(variableName, evaluationTree.evaluate());
		}else{
			this.engine.sto(variableName, 0);
		}
		this.debug('<-AplExecutionEnginePlugin#processVariableDeclaration()');
	}
	processArrayAffectation(instruction){
		this.debug('->AplExecutionEnginePlugin#processArrayAffectation()');
		let eu = r(instruction);
		let arrayName  = eu.itemValue(0);
		let index      = Math.floor(new EvaluationTree(eu.item(2).eu, this.engine, this).evaluate());
		let value      = new EvaluationTree(eu.item(5).eu, this.engine, this).evaluate();
		let array = this.engine.rcl(arrayName);
		if(Array.isArray(array)){ array[index] = value; }
		else{ this.engine.halt(arrayName+' is not an array'); }
		this.debug('<-AplExecutionEnginePlugin#processArrayAffectation()');
	}
	processPropertyAffectation(instruction){
		this.debug('->AplExecutionEnginePlugin#processPropertyAffectation()');
		let eu = r(instruction);
		let objName  = eu.itemValue(0);
		let propName = eu.itemValue(2);
		let value = new EvaluationTree(eu.item(4).eu, this.engine, this).evaluate();
		let obj = this.engine.rcl(objName);
		if(obj===null || obj===undefined){ this.engine.halt(objName+' is null or undefined'); return; }
		if(typeof obj=='object' && !Array.isArray(obj)){ obj[propName] = value; }
		else{ this.engine.halt(objName+' is not an object'); }
		this.debug('<-AplExecutionEnginePlugin#processPropertyAffectation()');
	}
	processPostIncrement(instruction){
		let varName = r(instruction).itemValue(0);
		this.engine.sto(varName, this.engine.rcl(varName) + 1);
	}
	processPostDecrement(instruction){
		let varName = r(instruction).itemValue(0);
		this.engine.sto(varName, this.engine.rcl(varName) - 1);
	}
	processAffectation(instruction){
		this.debug('->AplExecutionEnginePlugin#processAffectation()');
		let eu = r(instruction);
		let variableName = eu.itemValue(0);
		let returnValue = new EvaluationTree(eu.item(2).eu, this.engine, this).evaluate();
		this.engine.sto(variableName, returnValue);
		this.debug('<-AplExecutionEnginePlugin#processAffectation()');
	}
	processFunctionDeclaration(instruction){
		let functionName = r(instruction).inner().itemValue(1);
		this.engine.dcl(functionName, instruction);
	}
	processSimpleFunctionCall(instruction){
		let callEu = r(instruction).inner();
		let functionName = callEu.itemValue(0);
		let args = [];
		let argListEu = callEu.item(2);
		if(argListEu.eu.next){
			let rawArgs = extractArgumentList(argListEu.item(0).eu);
			let vals = [];
			for(var i=0;i<rawArgs.length;i++){
				vals.push(new EvaluationTree(rawArgs[i], this.engine, this).evaluate());
			}
			args = vals;
		}
		this.engine.pushStack(functionName+'()');
		let returnValue = this.engine.cal(functionName, args);
		this.engine.popStack();
		return returnValue;
	}
	processTest(instruction){
		this.debug('->AplExecutionEnginePlugin#processTest()');
		this.testImbricationLevel++;
		let namespace = 'if_'+this.testImbricationLevel;
		let eu = r(instruction).inner();
		let checkResult = Boolean(new EvaluationTree(eu.item(2).eu, this.engine, this).evaluate());
		this.trace('test evaluation returned '+checkResult);
		if(checkResult){
			let seq = eu.item(5).eu;
			if('INSTRUCTION_SEQUENCE'==seq.name){
				this.executionUnitPtr[namespace] = seq;
				let instr = this.getNextInstruction(namespace);
				while(instr!=null){ this.processInstruction(instr); instr = this.getNextInstruction(namespace); }
				delete this.executionUnitPtr[namespace];
			}
		}else{
			let elseNode = eu.item(6).eu;
			if('AND'==elseNode.name){
				let seq = r(elseNode).item(3).eu;
				if('INSTRUCTION_SEQUENCE'==seq.name){
					this.executionUnitPtr[namespace] = seq;
					let instr = this.getNextInstruction(namespace);
					while(instr!=null){ this.processInstruction(instr); instr = this.getNextInstruction(namespace); }
					delete this.executionUnitPtr[namespace];
				}
			}
		}
		this.testImbricationLevel--;
		this.debug('<-AplExecutionEnginePlugin#processTest()');
	}
	processForLoop(instruction){
		this.debug('->AplExecutionEnginePlugin#processForLoop()');
		this.testImbricationLevel++;
		let namespace = 'for_'+this.testImbricationLevel;
		let eu = r(instruction).inner();
		let loopVar = eu.itemValue(2);
		this.engine.sto(loopVar, new EvaluationTree(eu.item(4).eu, this.engine, this).evaluate());
		let condTree = new EvaluationTree(eu.item(6).eu, this.engine, this);
		let incrTree = new EvaluationTree(eu.item(8).eu, this.engine, this);
		let loopInstructions = eu.item(11).eu;
		while(condTree.evaluate()){
			if('INSTRUCTION_SEQUENCE'==loopInstructions.name){
				this.executionUnitPtr[namespace] = loopInstructions;
				let instr = this.getNextInstruction(namespace);
				while(instr!=null){ this.processInstruction(instr); instr = this.getNextInstruction(namespace); }
				delete this.executionUnitPtr[namespace];
			}
			this.engine.sto(loopVar, incrTree.evaluate());
		}
		this.testImbricationLevel--;
		this.debug('<-AplExecutionEnginePlugin#processForLoop()');
	}
	processWhileLoop(instruction){
		this.debug('->AplExecutionEnginePlugin#processWhileLoop()');
		this.testImbricationLevel++;
		let namespace = 'while_'+this.testImbricationLevel;
		let eu = r(instruction).inner();
		let condTree = new EvaluationTree(eu.item(2).eu, this.engine, this);
		let loopInstructions = eu.item(5).eu;
		while(Boolean(condTree.evaluate())){
			if('INSTRUCTION_SEQUENCE'==loopInstructions.name){
				this.executionUnitPtr[namespace] = loopInstructions;
				let instr = this.getNextInstruction(namespace);
				while(instr!=null){ this.processInstruction(instr); instr = this.getNextInstruction(namespace); }
				delete this.executionUnitPtr[namespace];
			}
		}
		this.testImbricationLevel--;
		this.debug('<-AplExecutionEnginePlugin#processWhileLoop()');
	}
	processInstruction(instruction){
		if(this.canProceed){
			if     ('VARIABLE_DECLARATION'==instruction.name)  { this.processVariableDeclaration(r(instruction).inner().eu); }
			else if('CONSTANT_DECLARATION'==instruction.name)  { this.processVariableDeclaration(r(instruction).inner().eu); }
			else if('ARRAY_AFFECTATION'==instruction.name)     { this.processArrayAffectation(r(instruction).inner().eu); }
			else if('PROPERTY_AFFECTATION'==instruction.name)  { this.processPropertyAffectation(r(instruction).inner().eu); }
			else if('POST_INCREMENT'==instruction.name)        { this.processPostIncrement(r(instruction).inner().eu); }
			else if('POST_DECREMENT'==instruction.name)        { this.processPostDecrement(r(instruction).inner().eu); }
			else if('AFFECTATION'==instruction.name)           { this.processAffectation(r(instruction).inner().eu); }
			else if('FUNCTION'==instruction.name)              { this.processFunctionDeclaration(instruction); }
			else if('AND'==instruction.name && r(instruction).firstChild().eu.name=='FUNCTION_CALL'){
				this.processSimpleFunctionCall(r(instruction).firstChild().eu);
			}
			else if('TEST'==instruction.name)      { this.processTest(instruction); }
			else if('FOR_LOOP'==instruction.name)  { this.processForLoop(instruction); }
			else if('WHILE_LOOP'==instruction.name){ this.processWhileLoop(instruction); }
			else{
				this.error('unsupported instruction "'+instruction.name+'" for '+this.grammar.name+' v'+this.grammar.version+'!');
			}
		}
	}
	process(executionUnit, engine){
		this.debug('->AplExecutionEnginePlugin#process()');
		this.engine = engine;
		this.executionUnitPtr = {};
		this.testImbricationLevel = 0;
		this.canProceed = true;
		this.executionUnitPtr[DEFAULT_NAMESPACE] = executionUnit;
		let instruction = this.getNextInstruction();
		while(instruction!=null){
			this.trace('processing instruction line #'+instruction.token.line);
			this.processInstruction(instruction);
			instruction = this.getNextInstruction();
		}
		this.debug('<-AplExecutionEnginePlugin#process()');
	}
	callFunction(executionUnit, args, engine){
		this.debug('->AplExecutionEnginePlugin#callFunction()');
		let funcEu = r(executionUnit).inner();
		let namespace = funcEu.itemValue(1);
		this.trace('function name: '+namespace);
		this.trace('arguments: '+JSON.stringify(args));
		let returnValue = true;
		let argNames = [];
		let paramListNode = funcEu.item(3).eu;
		if('AND'==paramListNode.name){
			argNames = extractArgumentNameList(r(paramListNode).item(0).eu);
		}
		if(argNames.length==args.length){
			for(var i=0;i<argNames.length;i++){
				engine.sto(argNames[i], args[i]);
			}
			let bodyNode = funcEu.item(5).eu;
			let returnExpressionIndex = 1;
			if('INSTRUCTION_SEQUENCE'==r(bodyNode).firstChild().eu.name){
				returnExpressionIndex = 2;
				this.executionUnitPtr[namespace] = r(bodyNode).firstChild().eu;
				let instr = this.getNextInstruction(namespace);
				while(instr!=null){ this.processInstruction(instr); instr = this.getNextInstruction(namespace); }
				delete this.executionUnitPtr[namespace];
			}
			let returnEu = bodyNode.next[returnExpressionIndex];
			returnValue = new EvaluationTree(returnEu, engine, this).evaluate();
		}else{
			this.error(namespace+'(): argument list and function parameter list do not match!');
		}
		this.debug('<-AplExecutionEnginePlugin#callFunction()');
		return returnValue;
	}
	halt(){
		this.error('AplExecutionEnginePlugin - immediate STOP requested!');
		this.canProceed = false;
	}
}

// ─── NPA Plugin service ──────────────────────────────────────────────────────

var plugin = new ApafPlugin();

/*
 * Execute an APL source string.
 *
 * @param {string}   source    - APL source code to compile and execute
 * @param {object}   builtins  - map of built-in functions exposed to the script:
 *                               { name: fn }  or  { name: { fn, async: true } }
 * @param {function} callback  - node-style callback(err, result)
 *                               result is { success, error, memorySpace } on success
 * @param {object}   [context] - optional map of variable name → initial value to pre-store
 *                               in the engine memory space before execution starts.
 *                               These become top-level variables accessible by name in the
 *                               script (e.g. { request: reqObj, response: {} }).
 *                               After execution, the final value of each variable can be
 *                               read back from result.memorySpace['.variableName'].
 */
plugin.compile = function(source, callback){
	this.debug('->apaf.apl#compile()');
	let compilerService = this.getService(COMPILER_SERVICE_NAME);
	let compileResult = compilerService.compile(source, APL_GRAMMAR);
	if(!compileResult.eu){
		this.debug('<-apaf.apl#compile() - failure');
		callback(null, { success: false, error: compileResult.error });
	} else {
		this.debug('<-apaf.apl#compile() - success');
		callback(null, { success: true, error: null });
	}
};

plugin.execute = function(source, builtins, callback, context){
	this.debug('->apaf.apl#execute()');
	let compilerService = this.getService(COMPILER_SERVICE_NAME);
	let compileResult = compilerService.compile(source, APL_GRAMMAR);
	if(!compileResult.eu){
		this.error('apaf.apl#execute() - compilation failed: '+compileResult.error);
		callback('APL compilation failed', null);
		return;
	}
	let self = this;
	let logRef = {
		debug:   function(txt){ self.debug(txt); },
		trace:   function(txt){ self.trace(txt); },
		info:    function(txt){ self.info(txt); },
		error:   function(txt){ self.error(txt); },
		warning: function(txt){ self.warning(txt); },
		canLog:  function(l){ return self.canLog(l); }
	};
	let enginePlugin = new AplExecutionEnginePlugin(logRef);
	// Always use the async path: pass the node-style callback as the completion callback.
	// npa.compiler#execute() will invoke it once all built-ins (sync or async) have finished.
	compilerService.execute(compileResult.eu, builtins, enginePlugin, context, function(err, result){
		if(err){
			self.error('apaf.apl#execute() - execution error: '+err);
			self.debug('<-apaf.apl#execute() - failure');
			callback(err, null);
		}else{
			self.debug('<-apaf.apl#execute() - success');
			callback(null, result);
		}
	});
};

module.exports = plugin;
