/*
 * commandPattern.js - a Command Pattern implementation library
 */

function Command(name){
	this.name = name;
}

Command.prototype.execute = function(){
	
}

Command.prototype.undo = function(){
	
}

Command.prototype.redo = function(){
	
}

function CommandStack(){
	this.stack = [];
	this.stackPtr = -1;
}

CommandStack.prototype.execute = function(command){
	console.log('CommandStack#execute()');
	if(this.stackPtr<(this.stack.length-1)){
		var newStack = [];
		for(var i=0;i<=this.stackPtr;i++){
			newStack.push(this.stack[i]);
		}
		this.stack = newStack;
	}
	try{
		console.log('-executing command '+command.name);
		command.execute();
		this.stack.push(command);
		this.stackPtr = this.stack.length-1;
	}catch(e){
		console.log('Exception executing command '+command.name);
		console.log(e);
	}
}

CommandStack.prototype.undo = function(){
	console.log('CommandStack#undo()');
	if(this.stackPtr>=0){
		var command = this.stack[this.stackPtr];
		try{
			console.log('-undoing command '+command.name);
			command.undo();
			this.stackPtr--;
		}catch(e){
			console.log('Exception undoing command '+command.name);
			console.log(e);
		}
	}
}

CommandStack.prototype.redo = function(){
	console.log('CommandStack#redo()');
	if(this.stackPtr<this.stack.length-1){
		this.stackPtr++;
		var command = this.stack[this.stackPtr];
		try{
			console.log('-redoing command '+command.name);
			command.redo();
		}catch(e){
			console.log('Exception redoing command '+command.name);
			console.log(e);
		}
	}
}

CommandStack.prototype.clear = function(){
	console.log('CommandStack#clear()');
	this.stack = [];
	this.stackPtr = -1;
}