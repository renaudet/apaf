/*
 * graphicalEditor.js : a generic, graphical editor that can be enhanced using customizations
 */
 
class WorkflowEventListener {
	eventHandler = function(event){};
	constructor(handler=null){
		if(handler){
			this.eventHandler = handler;
		}
	}
	handleEvent(event){
		this.eventHandler(event);
	}
}

var iconLoader = new ImageLoader();
iconLoader.addImage('deleteBtn','/uiTools/img/silk/cancel.png');
iconLoader.addImage('editBtn','/uiTools/img/silk/pencil.png');
iconLoader.addImage('default.node.icon','/resources/img/workflows/defaultNodeIcon.png');
iconLoader.addImage('terminal.icon.off','/resources/img/workflows/terminalIconOff.png');
iconLoader.addImage('terminal.icon.on','/resources/img/workflows/terminalIconOn.png');

function NodeProperty(name,label,type,allowOverride,defaultValue,allowedValues){
	this.name = name;
	this.label = label;
	this.type = type;
	this.override = allowOverride;
	if(allowedValues){
		this.allowedValues=allowedValues;
	}
	this.value = null;
	if(defaultValue || defaultValue==0){
		this.value = defaultValue;
	}
}

const NODE_MENU_HEIGHT = 16;
const MENU_ICONS_WIDTH = 16;
const MENU_ICONS_PADDING = 3;

function GraphicNode(id,type){
	this.id = id;
	this.type = type;
	this.x = 0;
	this.y = 0;
	this.selected = false;
	this.dragging = false;
	this.inputTerminals = [];//GraphicNodeTerminal
	this.outputTerminals = [];//GraphicNodeTerminal
	this.terminals = {};//GraphicNodeTerminal
	this.properties = {};
	this.properties['label'] = new NodeProperty('label','Node Label','string',false,id);
	this.backgroundIcon = iconLoader.getImage('default.node.icon');
	this.foregroundIcon = null;
	this.icon = null;
	this.handler = null;
	this.showMenu = false;
}

GraphicNode.prototype.getLabel = function(){
	return this.properties['label'].value;
}

GraphicNode.prototype.serialize = function(){
	var serialVer = {};
	serialVer.id = this.id;
	serialVer.type = this.type;
	serialVer.x = this.x;
	serialVer.y = this.y;
	serialVer.properties = {};
	for(name in this.properties){
		var nodeProp = this.properties[name];
		serialVer.properties[name] = nodeProp;
	}
	return serialVer;
}

GraphicNode.prototype.addProperty = function(name,label,type,allowOverride,defaultValue,allowedValues){
	var nodeProperty = new NodeProperty(name,label,type,allowOverride,defaultValue,allowedValues);
	this.properties[nodeProperty.name] = nodeProperty;
}

GraphicNode.prototype.setProperty = function(name,value){
	if(this.properties[name]){
		this.properties[name].value = value;
	}else{
		showWarning('Node #'+this.id+' does not define a property "'+name+'"');
	}
}

GraphicNode.prototype.getProperty = function(name){
	return this.properties[name].value;
}

GraphicNode.prototype.getPropertyType = function(name){
	return this.properties[name].type;
}

GraphicNode.prototype.getProperties = function(){
	var props = [];
	for(name in this.properties){
		var nodeProp = this.properties[name];
		props.push(nodeProp);
	}
	props = sortOn(props,'name');
	return props;
}

GraphicNode.prototype.repaint = function(gc){
	var iconHeight = this.backgroundIcon.height;
	var iconWidth = this.backgroundIcon.width;
	var deltaX = iconWidth/2;
	var deltaY = iconHeight/2;
	gc.drawImage(this.backgroundIcon,this.x-iconWidth/2,this.y-iconHeight/2);
	if(this.selected){
		gc.shadowOffsetX = 0;
    	gc.shadowOffsetY = 0;
    	gc.shadowBlur = 0;
    	gc.strokeStyle = '#666666';
    	gc.lineWidth = 1;
    	gc.beginPath();
        gc.moveTo(this.x-deltaX,this.y-deltaY);
        gc.lineTo(this.x+deltaX,this.y-deltaY);
        gc.lineTo(this.x+deltaX,this.y+deltaY);
        gc.lineTo(this.x-deltaX,this.y+deltaY);
        gc.lineTo(this.x-deltaX,this.y-deltaY);
        gc.stroke();
	}
	for(var i=0;i<this.inputTerminals.length;i++){
	    var inputTerminal = this.inputTerminals[i];
	    inputTerminal.repaint(gc);
	}
    for(var i=0;i<this.outputTerminals.length;i++){
	    var outputTerminal = this.outputTerminals[i];
	    outputTerminal.repaint(gc);
	}
	if(this.showMenu){
		gc.fillStyle = '#dceefa';
		gc.fillRect(this.x-deltaX, this.y-deltaY-NODE_MENU_HEIGHT, iconWidth, NODE_MENU_HEIGHT);
		var icon = iconLoader.getImage('deleteBtn');
		gc.drawImage(icon,this.x-deltaX,this.y-deltaY-NODE_MENU_HEIGHT);
		var icon = iconLoader.getImage('editBtn');
		gc.drawImage(icon,this.x-deltaX+MENU_ICONS_WIDTH+MENU_ICONS_PADDING,this.y-deltaY-NODE_MENU_HEIGHT);
	}
	gc.font = '10px sans-serif';
    gc.textBaseline = 'top';
    gc.fillStyle = '#000000';
    var labelWidth = gc.measureText(this.getLabel()).width;
    gc.fillText(this.getLabel(), this.x-(labelWidth/2),this.y+iconHeight/2);
    if(this.foregroundIcon){
    	gc.drawImage(this.foregroundIcon,this.x-this.foregroundIcon.width/2,this.y-this.foregroundIcon.height/2);
    }
}

GraphicNode.prototype.isTarget = function(mouseEvent){
	var x = mouseEvent.location.x;
	var y = mouseEvent.location.y;
	var dx = this.backgroundIcon.width/2;
	var dy = this.backgroundIcon.height/2;
	return x>=this.x-dx && x<=this.x+dx && y>=this.y-dy-NODE_MENU_HEIGHT && y<=this.y+dy;
}

GraphicNode.prototype.onMouseDown = function(mouseEvent){
	var delivered = false;
	for(var i=0;i<this.inputTerminals.length && !delivered;i++){
		var inputTerminal = this.inputTerminals[i];
		if(inputTerminal.isTarget(mouseEvent)){
			inputTerminal.onMouseDown(mouseEvent);
			delivered = true;
		}
	}
	for(var i=0;i<this.outputTerminals.length && !delivered;i++){
		var outputTerminal = this.outputTerminals[i];
		if(outputTerminal.isTarget(mouseEvent)){
			outputTerminal.onMouseDown(mouseEvent);
			delivered = true;
		}
	}
	if(!delivered){
		if(this.selected){
			var x = mouseEvent.location.x;
			var y = mouseEvent.location.y;
			if(this.backgroundIcon && this.showMenu){
				var dx = this.backgroundIcon.width/2;
				var dy = this.backgroundIcon.height/2;
				var x0 = this.x-dx+MENU_ICONS_WIDTH;
				if(x<=x0 && y<=(this.y-NODE_MENU_HEIGHT)){
					// delete menu
					this.fireEvent({"type": "node.deleted","source": this });
				}
				x0 += MENU_ICONS_PADDING;
				if(x>=x0 && x<= (x0+MENU_ICONS_WIDTH) && y<=(this.y-NODE_MENU_HEIGHT)){
					// edit menu
					this.fireEvent({"type": "edit.node","source": this });
				}
			}
		}else{
			var event = {};
			event.type = 'node.selected';
			event.source = this;
			this.fireEvent(event);
		}
	}
}

GraphicNode.prototype.onMouseUp = function(mouseEvent){
	var delivered = false;
	for(var i=0;i<this.inputTerminals.length && !delivered;i++){
		var inputTerminal = this.inputTerminals[i];
		if(inputTerminal.isTarget(mouseEvent)){
			inputTerminal.onMouseUp(mouseEvent);
			delivered = true;
		}
	}
	for(var i=0;i<this.outputTerminals.length && !delivered;i++){
		var outputTerminal = this.outputTerminals[i];
		if(outputTerminal.isTarget(mouseEvent)){
			delivered = outputTerminal.onMouseUp(mouseEvent);
		}
	}
	return delivered;
}

GraphicNode.prototype.onMouseMove = function(mouseEvent){
	this.x += mouseEvent.dx;
	this.y += mouseEvent.dy;
	
	if(this.backgroundIcon){
		var deltaY = this.backgroundIcon.height/(this.inputTerminals.length+1);
		var y = this.y-(this.backgroundIcon.height/2)+deltaY;
		for(var i=0;i<this.inputTerminals.length;i++){
			var inputTerminal = this.inputTerminals[i];
			inputTerminal.setPosition(this.x-this.backgroundIcon.width/2+2,y);
		    y += deltaY;
		}
		deltaY = this.backgroundIcon.height/(this.outputTerminals.length+1);
		y = this.y-(this.backgroundIcon.height/2)+deltaY;
		for(var i=0;i<this.outputTerminals.length;i++){
			var outputTerminal = this.outputTerminals[i];
			outputTerminal.setPosition(this.x+this.backgroundIcon.width/2-2,y);
		    y += deltaY;
		}
	}
	if(this.selected){
		var event = {};
		event.type = 'node.moved';
		event.source = this;
		this.fireEvent(event);
	}
}

GraphicNode.prototype.setLocation = function(x,y,gridSize){
	this.x = 0;
	this.y = 0;
	let dx = Math.floor(x/gridSize)*gridSize;
	let dy = Math.floor(y/gridSize)*gridSize;
	this.onMouseMove({"dx": dx,"dy": dy});
}

GraphicNode.prototype.onMouseOver = function(mouseEvent){
	if(this.selected && !this.showMenu){
		this.showMenu = true;
		this.fireRedrawNeeded();
	}
	var delivered = false;
	for(var i=0;i<this.inputTerminals.length && !delivered;i++){
		var inputTerminal = this.inputTerminals[i];
		if(inputTerminal.isTarget(mouseEvent)){
			inputTerminal.onMouseOver(mouseEvent);
			delivered = true;
		}
	}
	for(var i=0;i<this.outputTerminals.length && !delivered;i++){
		var outputTerminal = this.outputTerminals[i];
		if(outputTerminal.isTarget(mouseEvent)){
			outputTerminal.onMouseOver(mouseEvent);
			delivered = true;
		}
	}
}

GraphicNode.prototype.fireRedrawNeeded = function(){
	this.fireEvent({"type": "state.changed","source": this });
}

GraphicNode.prototype.fireEvent = function(event){
	this.handler.handleEvent(event);
}

GraphicNode.prototype.onPropertyEdited = function(){
	this.fireEvent({"type": "node.edited","source": this });
}

GraphicNode.prototype.setSelected = function(selected){
	this.selected = selected;
	if(!this.selected){
		this.showMenu = false;
	}
}

GraphicNode.prototype.addInputTerminal = function(nodeTerminal){
	this.inputTerminals.push(nodeTerminal);
	this.terminals[nodeTerminal.name] = nodeTerminal;
	nodeTerminal.node = this;
	nodeTerminal.input = true;
}

GraphicNode.prototype.addOutputTerminal = function(nodeTerminal){
	this.outputTerminals.push(nodeTerminal);
	this.terminals[nodeTerminal.name] = nodeTerminal;
	nodeTerminal.node = this;
	nodeTerminal.input = false;
}

function GraphicNodeTerminal(name,multiple = false){
	this.name = name;
	this.x = 0;
	this.y = 0;
	this.node = null;
	this.input = false;
	this.highlighted = false;
	this.connected = false;
	this.connection = null;
	this.connections = [];
	this.icon = iconLoader.getImage('terminal.icon.off');
	this.activatedIcon = iconLoader.getImage('terminal.icon.on');
	this.allowMultiple = multiple;
}

GraphicNodeTerminal.prototype.setPosition = function(x,y){
	this.x = x;
	this.y = y;
}

GraphicNodeTerminal.prototype.getId = function(){
	return this.node.id+'#'+this.name
}

GraphicNodeTerminal.prototype.repaint = function(gc){
	var img = this.icon;
	if(this.connected){
		img = this.activatedIcon;
	}
	gc.drawImage(img,this.x-img.width/2,this.y-img.height/2);
	
	if(this.highlighted){
		gc.shadowOffsetX = 0;
    	gc.shadowOffsetY = 0;
    	gc.shadowBlur = 0;
    	gc.strokeStyle = '#55709e';
    	gc.lineWidth = 2;
    	gc.beginPath();
    	var deltaX = img.width/2-3;
    	var deltaY = img.height/2-3;
        gc.moveTo(this.x-deltaX,this.y-deltaY);
        gc.lineTo(this.x+deltaX,this.y-deltaY);
        gc.lineTo(this.x+deltaX,this.y+deltaY);
        gc.lineTo(this.x-deltaX,this.y+deltaY);
        gc.lineTo(this.x-deltaX,this.y-deltaY);
        gc.stroke();
		this.highlighted = false;
		
		gc.font = '10px sans-serif';
	    gc.textBaseline = 'top';
	    gc.fillStyle = '#000000';
	    var labelWidth = gc.measureText(this.name).width;
	    if(this.input){
	    	gc.fillText(this.name,this.x-(img.width/2)-labelWidth-2,this.y-(img.height/2)-6);
	    }else{
	    	gc.fillText(this.name,this.x+(img.width/2)+2,this.y-(img.height/2)-6);
	    }
	}
}

GraphicNodeTerminal.prototype.onMouseDown = function(mouseEvent){
	console.log(this.name+' #onMouseDown()');
	if(!this.input && (this.allowMultiple || !this.connected)){
		var event = {};
		event.type = 'connection.start';
		event.source = this;
		this.node.fireEvent(event);
	}
	if(this.connected){
		var event = {};
		event.type = 'connection.selected';
		if(this.allowMultiple){
			event.source = this.connections[this.connections.length-1];
		}else{
			event.source = this.connection;
		}
		this.node.fireEvent(event);
	}
}

GraphicNodeTerminal.prototype.onMouseUp = function(mouseEvent){
	if(this.input && (this.allowMultiple || !this.connected)){
		var event = {};
		event.type = 'connection.end';
		event.source = this;
		this.node.fireEvent(event);
		return true;
	}
	return false;
}

GraphicNodeTerminal.prototype.onMouseOver = function(mouseEvent){
	this.highlighted = true;
	this.node.fireRedrawNeeded();
}

GraphicNodeTerminal.prototype.isTarget = function(mouseEvent){
	var x = mouseEvent.location.x;
	var y = mouseEvent.location.y;
	if(this.connected){
		var deltaX = this.activatedIcon.width/2;
		var deltaY = this.activatedIcon.height/2;
		return x>=this.x-deltaX && x<=this.x+deltaX && y>=this.y-deltaY && y<=this.y+deltaY;
	}else{
		var deltaX = this.icon.width/2;
		var deltaY = this.icon.height/2;
		return x>=this.x-deltaX && x<=this.x+deltaX && y>=this.y-deltaY && y<=this.y+deltaY;
	}
}

GraphicNodeTerminal.prototype.addConnection = function(conn){
	if(conn){
		if(this.allowMultiple){
			this.connections.push(conn);
		}else{
			this.connection = conn;
		}
		this.connected = true;
	}
}

GraphicNodeTerminal.prototype.removeConnection = function(conn){
	if(conn){
		if(this.allowMultiple){
			var result = [];
			for(var i=0;i<this.connections.length;i++){
				var connection = this.connections[i];
				if(conn!=connection){
					result.push(connection);
				}
			}
			this.connections = result;
			this.connected = this.connections.length>0;
		}else{
			this.connection = null;
			this.connected = false;
		}
	}
}

function GraphicNodeConnection(source,target){
	this.source = source;
	this.target = target;
	this.selected = false;
	if(this.source){
		this.source.addConnection(this);
	}
	if(this.target){
		this.target.addConnection(this);
	}
}

GraphicNodeConnection.prototype.serialize = function(){
	var serialVer = {};
	serialVer.source = this.source.getId();
	serialVer.target = this.target.getId();
	return serialVer;
}

GraphicNodeConnection.prototype.getName = function(){
	return this.source.node.id+'#'+this.source.name+'-'+this.target.node.id+'#'+this.target.name;
}

GraphicNodeConnection.prototype.repaint = function(gc){
	gc.shadowOffsetX = 0;
	gc.shadowOffsetY = 0;
	gc.shadowBlur = 0;
	gc.strokeStyle = '#55709e';
	gc.lineWidth = 2;
	if(this.selected){
		gc.lineWidth = 3;
		gc.strokeStyle = '#9c6b3a';
	}
	gc.beginPath();
	const DELTA = 25;
	if(this.source.x < (this.target.x-DELTA-DELTA)){
		var midX = (this.source.x+this.target.x)/2;
	    gc.moveTo(this.source.x,this.source.y);
	    gc.lineTo(midX,this.source.y);
	    gc.lineTo(midX,this.target.y);
	    gc.lineTo(this.target.x,this.target.y);
	}else{
		var midY = (this.source.y+this.target.y)/2;
		gc.moveTo(this.source.x,this.source.y);
		gc.lineTo(this.source.x+DELTA,this.source.y);
		gc.lineTo(this.source.x+DELTA,midY);
		gc.lineTo(this.target.x-DELTA,midY);
		gc.lineTo(this.target.x-DELTA,this.target.y);
		gc.lineTo(this.target.x,this.target.y);
	}
    gc.stroke();
}

GraphicNodeConnection.prototype.select = function(){
	this.selected = true;
}

GraphicNodeConnection.prototype.release = function(){
	this.selected = false;
}

GraphicNodeConnection.prototype.setSource = function(terminal){
	if(this.source){
		this.source.removeConnection(this);
	}
	this.source = terminal;
	if(this.source){
		this.source.addConnection(this);
	}
}

GraphicNodeConnection.prototype.setTarget = function(terminal){
	if(this.target){
		this.target.removeConnection(this);
	}
	this.target = terminal;
	if(this.target){
		this.target.addConnection(this);
	}
}

const NODE_FACTORY_PADDING = 5;
const HEADER_HEIGHT = 20;
const NODE_FACTORY_HEADER_HEIGHT = 15;

function GraphicNodePalette(title,width,parent){
	this.title = title;
	this.width = width;
	this.parent = parent;
	this.factories = []; //GraphicNodeFactory
	this.factoryByType = {}; //cache
	this.dragging = false;
	this.dragY = 0;
	this.dragStartY = 0;
	this.shiftY = 0;
	this.targetFactory = null;
	this.highlightedFactory = false;
	this.backgroundColor = '#e3d4af';
}

GraphicNodePalette.prototype.isTarget = function(mouseEvent){
	var x = mouseEvent.location.x;
	if(x<=this.width){
		return true;
	}else{
		this.dragging = false;
		return false;
	}
}

GraphicNodePalette.prototype.fireRedrawNeeded = function(){
	this.parent.repaint();
}

GraphicNodePalette.prototype.repaint = function(gc){
	gc.shadowOffsetX = 0;
	gc.shadowOffsetY = 0;
	gc.shadowBlur = 0;
	gc.fillStyle = this.backgroundColor;
	gc.fillRect(0, 0, this.width, this.parent.height);
	
	var loc = HEADER_HEIGHT+NODE_FACTORY_PADDING+this.shiftY;
	let factories = sortOn(this.factories,'name');
	for(var i=0;i<factories.length;i++){
		var factory = factories[i];
		factory.setVerticalLocation(loc);
		factory.repaint(gc);
		loc += factory.computeHeight()+NODE_FACTORY_PADDING;
	}
	gc.fillStyle = '#405980';
	gc.fillRect(0, 0, this.width, HEADER_HEIGHT); 
	gc.font = '12px sans-serif';
    gc.textBaseline = "top";
    gc.fillStyle = '#ffffff';
    var labelWidth = gc.measureText(this.title).width;
    gc.fillText(this.title, (this.width-labelWidth)/2,6);
    if(!this.dragging){
	    if(this.shiftY<0 && loc<100){
	    	this.shiftY += 1;
	    	var palette = this;
	    	setTimeout(function(){ palette.fireRedrawNeeded(); },10);
	    }
	    if(this.shiftY>0){
	    	this.shiftY -= 1;
	    	var palette = this;
	    	setTimeout(function(){ palette.fireRedrawNeeded(); },10);
	    }
    }
}

GraphicNodePalette.prototype.onMouseDown = function(mouseEvent){
	var y = mouseEvent.location.y;
	var delivered = false;
	for(var i=0;i<this.factories.length && !delivered;i++){
		var factory = this.factories[i];
		if(factory.isCreationTarget(mouseEvent)){
			factory.onMouseDown(mouseEvent);
			delivered = true;
		}
		if(factory.isHeaderTarget(mouseEvent)){
			this.targetFactory = factory;
		}
	}
	if(!delivered){
		this.dragging = true;
		this.dragStartY = y;
		this.dragY = y;
	}
}

GraphicNodePalette.prototype.onMouseUp = function(mouseEvent){
	var y = mouseEvent.location.y;
	if(this.dragging){
		this.dragging = false;
		var delivered = false;
		for(var i=0;i<this.factories.length && !delivered;i++){
			var factory = this.factories[i];
			if(factory.isHeaderTarget(mouseEvent) && this.targetFactory == factory){
				if(Math.abs(this.dragStartY-y)<=NODE_FACTORY_HEADER_HEIGHT){
					factory.triggerState();
					delivered = true;
					this.fireRedrawNeeded();
				}
			}
		}
		if(!delivered){
			this.fireRedrawNeeded();
		}
	}
}

GraphicNodePalette.prototype.onMouseMove = function(mouseEvent){
	var y = mouseEvent.location.y;
	if(this.dragging){
		this.shiftY += (y-this.dragY);
		this.dragY = y;
		this.fireRedrawNeeded();
	}else{
		var highlightedFound = false;
		for(var i=0;i<this.factories.length;i++){
			var factory = this.factories[i];
			if(factory.isCreationTarget(mouseEvent)){
				factory.onMouseOver(mouseEvent);
				highlightedFound = true;
			}
		}
		if(highlightedFound){
			this.highlightedFactory = true;
		}else{
			if(this.highlightedFactory){
				this.highlightedFactory = false;
				this.fireRedrawNeeded();
			}
		}
	}
}

GraphicNodePalette.prototype.addFactory = function(factory){
	this.factories.push(factory);
	factory.setPalette(this);
	this.factoryByType[factory.name] = factory;
}

GraphicNodePalette.prototype.getFactory = function(type){
	return this.factoryByType[type];
}

GraphicNodePalette.prototype.onNodeCreated = function(source,node){
	var event = {};
	event.type = 'node.created';
	event.source = source;
	event.node = node;
	this.parent.handleEvent(event);
}

function GraphicNodeFactory(name,iconImage){
	this.name = name;
	this.icon = iconImage;
	this.palette = null;
	this.isOpen = true;
	this.verticalLocation = 0;
	this.highlighted = false;
	this.instanceCount = 0;
}

GraphicNodeFactory.prototype.setPalette = function(palette){
	this.palette = palette;
}

GraphicNodeFactory.prototype.triggerState = function(){
	this.isOpen = !this.isOpen;
}

GraphicNodeFactory.prototype.fireRedrawNeeded = function(){
	this.palette.fireRedrawNeeded();
}

GraphicNodeFactory.prototype.isCreationTarget = function(mouseEvent){
	if(this.isOpen){
		var x = mouseEvent.location.x;
		var y = mouseEvent.location.y;
		var width = this.palette.width-2*NODE_FACTORY_PADDING;
		var height = NODE_FACTORY_HEADER_HEIGHT+this.icon.height;
		return x>=NODE_FACTORY_PADDING && x<=(width+NODE_FACTORY_PADDING) && y>=(this.verticalLocation+NODE_FACTORY_HEADER_HEIGHT) && y<=(this.verticalLocation+height);
	}
	return false;
}

GraphicNodeFactory.prototype.isHeaderTarget = function(mouseEvent){
	var x = mouseEvent.location.x;
	var y = mouseEvent.location.y;
	var width = this.palette.width-2*NODE_FACTORY_PADDING;
	return x>=NODE_FACTORY_PADDING && x<=(width+NODE_FACTORY_PADDING) && y>=this.verticalLocation && y<=(this.verticalLocation+NODE_FACTORY_HEADER_HEIGHT);
}

GraphicNodeFactory.prototype.setVerticalLocation = function(location){
	this.verticalLocation = location;
}

GraphicNodeFactory.prototype.onMouseDown = function(mouseEvent){
	var node = this.createNode();
	let gridSize = this.palette.parent.gridSize;
	let x = mouseEvent.location.x+this.palette.width+20;
	let y = mouseEvent.location.y;
	var locX = Math.floor(x/gridSize)*gridSize;
	var locY = Math.floor(y/gridSize)*gridSize;
	node.onMouseMove({"dx": locX,"dy": locY});
	this.palette.onNodeCreated(this,node);
}

GraphicNodeFactory.prototype.onMouseUp = function(mouseEvent){
	
}

GraphicNodeFactory.prototype.onMouseOver = function(mouseEvent){
	this.highlighted = true;
	this.fireRedrawNeeded();
}

GraphicNodeFactory.prototype.repaint = function(gc){
	if(this.isOpen){
		gc.shadowOffsetX = 0;
		gc.shadowOffsetY = 0;
		gc.shadowBlur = 0;
		var width = this.palette.width-2*NODE_FACTORY_PADDING;
		if(this.highlighted){
			gc.fillStyle = '#81b1fc';
			gc.fillRect(NODE_FACTORY_PADDING, this.verticalLocation+NODE_FACTORY_HEADER_HEIGHT, width, this.icon.height);
			gc.fillStyle = '#ffffff';
			gc.fillRect(NODE_FACTORY_PADDING+2, this.verticalLocation+NODE_FACTORY_HEADER_HEIGHT+2, width-4, this.icon.height-4);
		}else{
			gc.fillStyle = '#ffffff';
			gc.fillRect(NODE_FACTORY_PADDING, this.verticalLocation+NODE_FACTORY_HEADER_HEIGHT, width, this.icon.height);
		}
		gc.fillStyle = '#405980';
		gc.fillRect(NODE_FACTORY_PADDING, this.verticalLocation, width, NODE_FACTORY_HEADER_HEIGHT);
		gc.font = '11px sans-serif';
	    gc.textBaseline = "top";
	    gc.fillStyle = '#ffffff';
	    var labelWidth = gc.measureText(this.name).width;
	    gc.fillText(this.name, NODE_FACTORY_PADDING+(width-labelWidth)/2,this.verticalLocation+2);
	    var baseY = this.verticalLocation+NODE_FACTORY_HEADER_HEIGHT+0.3;
	    gc.drawImage(this.icon,NODE_FACTORY_PADDING+(width-this.icon.width)/2,baseY);
	}else{
		gc.shadowOffsetX = 0;
		gc.shadowOffsetY = 0;
		gc.shadowBlur = 0;
		gc.fillStyle = '#5b7fb5';
		var width = this.palette.width-2*NODE_FACTORY_PADDING;
		gc.fillRect(NODE_FACTORY_PADDING, this.verticalLocation, width, NODE_FACTORY_HEADER_HEIGHT);
		gc.font = '11px sans-serif';
	    gc.textBaseline = "top";
	    gc.fillStyle = '#ffffff';
	    var labelWidth = gc.measureText(this.name).width;
	    gc.fillText(this.name, NODE_FACTORY_PADDING+(width-labelWidth)/2,this.verticalLocation+2);
	}
	this.highlighted = false;
}

GraphicNodeFactory.prototype.close = function(){
	this.isOpen = false;
}

GraphicNodeFactory.prototype.open = function(){
	this.isOpen = true;
}

GraphicNodeFactory.prototype.createNode = function(){
	return {};
}

GraphicNodeFactory.prototype.computeHeight = function(){
	if(this.isOpen){
		return NODE_FACTORY_HEADER_HEIGHT+this.icon.height;
	}else{
		return NODE_FACTORY_HEADER_HEIGHT;
	}
}

function showSelection(arrayOfNodes){
	if(arrayOfNodes.length==0){
		console.log('Selection: empty');
	}else{
		console.log('Selection:');
		for(var i=0;i<arrayOfNodes.length;i++){
			console.log('-'+arrayOfNodes[i].id);
		}
	}
}

function GraphicalEditor(id,parentId,properties){
	this.id = id;
	this.parentId = parentId;
	this.commandStack = new CommandStack();
	this.gcManager = new ReactivArea(id,parentId,$('#'+parentId).width(),$('#'+parentId).height());
	if(properties.backgroundColor){
		this.gcManager.background = properties.backgroundColor;
	}else{
		this.gcManager.background = '#ffffff';
	}
	var paletteTitle = 'Nodes';
	if(properties.paletteTitle){
		paletteTitle = properties.paletteTitle;
	}
	this.gcManager.palette = new GraphicNodePalette(paletteTitle,80,this.gcManager);
	if(properties.paletteColor){
		this.gcManager.palette.backgroundColor = properties.paletteColor;
	}
	this.gcManager.dragTarget = null;
	this.gcManager.stack = this.commandStack;
	this.gcManager.nodeCache = {};
	this.gcManager.selection = [];
	this.gcManager.holdSelection = false;
	this.gcManager.dragMode = false;
	this.gcManager.connectionMode = false;
	this.gcManager.selectedConnection = null;
	// this for connection support
	this.gcManager.connectorCache = {};
	this.gcManager.name = 'freeForm';
	this.gcManager.node = { "id": "null"};
	this.gcManager.x = 0;
	this.gcManager.y = 0;
	this.gcManager.dragCmd = null;
	this.gcManager.dragStartX = 0;
	this.gcManager.dragStartY = 0;
	this.gcManager.gridSize = 1;
	this.gcManager.showGrid = false;
	this.gcManager.gridColor = '#d3d3d3';
	if(properties.gridSize){
		this.gcManager.gridSize = properties.gridSize;
	}
	if(typeof properties.showGrid!='undefined'){
		this.gcManager.showGrid = properties.showGrid;
	}
	if(properties.gridColor){
		this.gcManager.gridColor = properties.gridColor;
	}
	this.gcManager.confirmDelete = true;
	if(typeof properties.confirmDelete!='undefined'){
		this.gcManager.confirmDelete = properties.confirmDelete;
	}
	
	this.gcManager.onResized = function(){
	}
	this.gcManager.getId = function(){
		return this.name;
	}
	this.gcManager.onMouseDown = function(mouseEvent){
		if(this.palette.isTarget(mouseEvent)){
			this.dragTarget = this.palette;
			this.palette.onMouseDown(mouseEvent);
		}else{
			var delivered = false;
			for(var nodeId in this.nodeCache){
				var node = this.nodeCache[nodeId];
				if(!delivered && node.isTarget(mouseEvent)){
					node.onMouseDown(mouseEvent);
					delivered = true;
				}
			}
			if(!delivered){
				this.deselectAllNodes();
				this.selectConnection(null);
				this.dragMode = true;
				this.dragCmd = new Command('Move all');
				this.dragCmd.manager = this;
				//this.dragCmd.dragStartX = mouseEvent.location.x;
				//this.dragCmd.dragStartY = mouseEvent.location.y;
				this.dragCmd.dragStartX = Math.floor(mouseEvent.location.x/this.gridSize)*this.gridSize;
				this.dragCmd.dragStartY = Math.floor(mouseEvent.location.y/this.gridSize)*this.gridSize;
				this.dragCmd.execute = function(){
					var dx = this.dragEndX-this.dragStartX;
					var dy = this.dragEndY-this.dragStartY;
					var me = { "dx": dx,"dy": dy };
					for(nodeId in this.manager.nodeCache){
						var node = this.manager.nodeCache[nodeId];
						node.onMouseMove(me);
					}
					this.manager.repaint();
				}
				this.dragCmd.undo = function(){
					var dx = -(this.dragEndX-this.dragStartX);
					var dy = -(this.dragEndY-this.dragStartY);
					var me = { "dx": dx,"dy": dy };
					for(nodeId in this.manager.nodeCache){
						var node = this.manager.nodeCache[nodeId];
						node.onMouseMove(me);
					}
					this.manager.repaint();
				}
				this.dragCmd.redo = function(){
					this.execute();
				}
			}else{
				if(!this.connectionMode){
					this.dragMode = true;
					this.dragTarget = this.selection;
					//this.dragStartX = mouseEvent.location.x;
					//this.dragStartY = mouseEvent.location.y;
					this.dragStartX = Math.floor(mouseEvent.location.x/this.gridSize)*this.gridSize;;
					this.dragStartY = Math.floor(mouseEvent.location.y/this.gridSize)*this.gridSize;
					this.dragCmd = new Command('Move selection');
					this.dragCmd.manager = this;
					this.dragCmd.selection = this.selection;
					this.dragCmd.dragStartX = this.dragStartX;
					this.dragCmd.dragStartY = this.dragStartY;
					this.dragCmd.execute = function(){
					}
					this.dragCmd.undo = function(){
						var dx = -(this.dragEndX-this.dragStartX);
						var dy = -(this.dragEndY-this.dragStartY);
						var me = { "dx": dx,"dy": dy };
						for(var i=0;i<this.selection.length;i++){
							var node = this.selection[i];
							node.onMouseMove(me);
						}
						this.manager.repaint();
					}
					this.dragCmd.redo = function(){
						var dx = this.dragEndX-this.dragStartX;
						var dy = this.dragEndY-this.dragStartY;
						var me = { "dx": dx,"dy": dy };
						for(var i=0;i<this.selection.length;i++){
							var node = this.selection[i];
							node.onMouseMove(me);
						}
						this.manager.repaint();
					}
				}
			}
		}
	}
	this.gcManager.onMouseUp = function(mouseEvent){
		if(this.palette.isTarget(mouseEvent)){
			this.palette.onMouseUp(mouseEvent);
		}else{
			if(this.connectionMode){
				var delivered = false;
				for(nodeId in this.nodeCache){
					var node = this.nodeCache[nodeId];
					if(!delivered && node.isTarget(mouseEvent)){
						if(node.onMouseUp(mouseEvent)){
							delivered = true;
						}
					}
				}
				if(!delivered){
					if(this.selectedConnection){
						this.deregisterConnector(this.selectedConnection);
						this.selectedConnection.setSource(null);
					}
					this.connectionMode = false;
					this.dragTarget = null;
					this.selectedConnection = null;
					this.repaint();
				}
			}else
			if(this.dragMode){
				//this.dragCmd.dragEndX = mouseEvent.location.x;
				//this.dragCmd.dragEndY = mouseEvent.location.y;
				this.dragCmd.dragEndX = Math.floor(mouseEvent.location.x/this.gridSize)*this.gridSize;
				this.dragCmd.dragEndY = Math.floor(mouseEvent.location.y/this.gridSize)*this.gridSize;
				if(this.dragCmd.dragEndX!=this.dragCmd.dragStartX || this.dragCmd.dragEndY!=this.dragCmd.dragStartY){
					this.stack.execute(this.dragCmd);
				}
			}
			this.dragMode = false;
		}
		this.dragTarget = null;
		this.connectionMode = false;
	}
	this.gcManager.onMouseMove = function(mouseEvent){
		this.x = mouseEvent.location.x;
		this.y = mouseEvent.location.y;
		if(this.dragTarget!=null){
			if(this.dragTarget==this.palette){
				this.palette.onMouseMove(mouseEvent);
			}else
			if(this.dragTarget==this.selection){
				let x = Math.floor(mouseEvent.location.x/this.gridSize)*this.gridSize;
				let y = Math.floor(mouseEvent.location.y/this.gridSize)*this.gridSize;
				//var dx = mouseEvent.location.x-this.dragStartX;
				//var dy = mouseEvent.location.y-this.dragStartY;
				var dx = x-this.dragStartX;
				var dy = y-this.dragStartY;
				mouseEvent.dx = dx;
				mouseEvent.dy = dy;
				for(var i=0;i<this.selection.length;i++){
					var node = this.selection[i];
					node.onMouseMove(mouseEvent);
				}
				this.repaint();
				//this.dragStartX = mouseEvent.location.x;
				//this.dragStartY = mouseEvent.location.y;
				this.dragStartX = x;
				this.dragStartY = y;
			}else
			if(this.dragTarget==this.selectedConnection){
				var delivered = false;
				for(nodeId in this.nodeCache){
					var node = this.nodeCache[nodeId];
					if(!delivered && node.isTarget(mouseEvent)){
						node.onMouseOver(mouseEvent);
						delivered = true;
					}
				}
				if(!delivered){
					this.repaint();
				}
			}
		}else
		if(this.palette.isTarget(mouseEvent)){
			this.palette.onMouseMove(mouseEvent);
		}else{
			var delivered = false;
			for(nodeId in this.nodeCache){
				var node = this.nodeCache[nodeId];
				if(!delivered && node.isTarget(mouseEvent)){
					node.onMouseOver(mouseEvent);
					delivered = true;
				}
			}
		}
	}
	this.gcManager.onKeyUp = function(keyEvent){
		if(keyEvent.keyCode==16){
			this.holdSelection = false;
		}
	}
	this.gcManager.onKeyDown = function(keyEvent){
		if(keyEvent.keyCode==16){
			this.holdSelection = true;
		}
		if(keyEvent.keyCode==46 && this.selectedConnection && (!this.confirmDelete || confirm('Delete this connection ?'))){
			var cmd = new Command('Delete Connnection');
			cmd.manager = this;
			cmd.connection = this.selectedConnection;
			cmd.execute = function(){
				this.manager.deregisterConnector(this.connection);
				this.source = this.connection.source;
				this.target = this.connection.target;
				this.connection.setSource(null);
				this.connection.setTarget(null);
				this.manager.repaint();
				this.manager.fireEvent({"type": "connection.deleted","source": this.source});
			}
			cmd.undo = function(){
				this.connection = new GraphicNodeConnection(this.source,this.target);
				this.manager.registerConnector(this.connection);
				this.manager.repaint();
				this.manager.fireEvent({"type": "connection.restored","source": this.source});
			}
			cmd.redo = function(){
				this.execute();
			}
			this.stack.execute(cmd);
		}
	}
	this.gcManager.paintGrid = function(gc){
		if(this.showGrid){
			gc.shadowOffsetX = 0;
			gc.shadowOffsetY = 0;
			gc.shadowBlur = 0;
			gc.strokeStyle = this.gridColor;
			gc.lineWidth = 1;
			let x = 0.33;
			while(x<this.width){
				gc.beginPath();
			    gc.moveTo(x,0);
			    gc.lineTo(x,this.height);
		    	gc.stroke();
		    	x+=this.gridSize+0.33;
			}
			let y = 0.33;
			while(y<this.height){
				gc.beginPath();
			    gc.moveTo(0,y);
			    gc.lineTo(this.width,y);
		    	gc.stroke();
		    	y+=this.gridSize+0.33;
			}
		}
	}
	this.gcManager.paint = function(gc){
		this.paintGrid(gc);
		for(connId in this.connectorCache){
			var conn = this.connectorCache[connId];
			conn.repaint(gc);
		}
		for(nodeId in this.nodeCache){
			var node = this.nodeCache[nodeId];
			node.repaint(gc);
		}
		this.palette.repaint(gc);
	}
	this.gcManager.deselectAllNodes = function(){
		var cmd = new Command('De-select all Nodes');
		cmd.manager = this;
		cmd.execute = function(){
			this.previousSelection = this.manager.cloneSelection();
			this.manager.setSelection([]);
			this.manager.repaint();
		}
		cmd.undo = function(){
			this.manager.setSelection(this.previousSelection);
			this.manager.repaint();
		}
		cmd.redo = function(){
			this.execute();
		}
		this.stack.execute(cmd);
	}
	this.gcManager.addConnection = function(conn){
		// to conform to the GraphicNodeTerminal API
	}
	this.gcManager.selectConnection = function(conn){
		if(this.selectedConnection){
			this.selectedConnection.release();
		}
		this.selectedConnection = conn;
		if(this.selectedConnection){
			this.selectedConnection.select();
			this.deselectAllNodes();
		}
		this.repaint();
	}
	this.gcManager.setSelection = function(selection){
		for(var i=0;i<this.selection.length;i++){
			var node = this.selection[i];
			node.setSelected(false);
		}
		this.selection = selection;
		for(var i=0;i<this.selection.length;i++){
			var node = this.selection[i];
			node.setSelected(true);
		}
		showSelection(this.selection);
	}
	this.gcManager.cloneSelection = function(){
		var clone = [];
		for(var i=0;i<this.selection.length;i++){
			clone.push(this.selection[i]);
		}
		return clone;
	}
	this.gcManager.registerNode = function(node){
		this.nodeCache[node.id] = node;
		node.handler = this;
	}
	this.gcManager.unregisterNode = function(node){
		delete this.nodeCache[node.id];
	}
	this.gcManager.registerConnector = function(connector){
		this.connectorCache[connector.getName()] = connector;
		connector.handler = this;
	}
	this.gcManager.getConnectorByName = function(connectorName){
		return this.connectorCache[connectorName];
	}
	this.gcManager.deregisterConnector = function(connector){
		if(connector){
			delete this.connectorCache[connector.getName()];
		}
	}
	this.gcManager.getFactory = function(type){
		return this.palette.getFactory(type);
	}
	this.gcManager.fireEvent = function(event){
		if(this.eventListener){
			try{
				this.eventListener.handleEvent(event);
			}catch(e){
				console.log('Exception');
				console.log(e);
			}
		}
	}
	this.gcManager.handleEvent = function(event){
		if(event.type=='node.created'){
			var node = event.node;
			var cmd = new Command('Add Node '+node.id);
			cmd.manager = this;
			cmd.node = node;
			cmd.execute = function(){
				this.manager.registerNode(this.node);
				this.manager.repaint();
			}
			cmd.undo = function(){
				this.manager.unregisterNode(this.node);
				this.manager.repaint();
			}
			cmd.redo = function(){
				this.execute();
			}
			this.stack.execute(cmd);
		}
		if(event.type=='node.selected'){
			var node = event.source;
			var cmd = new Command('Select Node '+node.id);
			cmd.manager = this;
			cmd.node = node;
			cmd.holdSelection = this.holdSelection;
			cmd.execute = function(){
				this.previousSelection = this.manager.cloneSelection();
				if(!this.holdSelection){
					this.manager.setSelection([]);
				}
				this.manager.selection.push(node);
				this.node.setSelected(true);
				showSelection(this.manager.selection);
				this.manager.repaint();
			}
			cmd.undo = function(){
				this.manager.setSelection(this.previousSelection);
				this.manager.repaint();
			}
			cmd.redo = function(){
				this.execute();
			}
			this.stack.execute(cmd);
		}
		if(event.type=='state.changed'){
			this.repaint();
		}
		if(event.type=='node.deleted'){
			var node = event.source;
			if(!this.confirmDelete || confirm('Delete node '+node.id+' ?')){
				var cmd = new Command('Delete Node '+node.id);
				cmd.manager = this;
				cmd.node = node;
				cmd.execute = function(){
					this.manager.unregisterNode(this.node);
					this.manager.repaint();
				}
				cmd.undo = function(){
					this.manager.registerNode(this.node);
					this.manager.repaint();
					this.manager.fireEvent({"type": "node.restored","source": this.node});
				}
				cmd.redo = function(){
					this.execute();
					this.manager.fireEvent({"type": "node.deleted","source": this.node});
				}
				this.stack.execute(cmd);
			}
		}
		if(event.type=='edit.node'){
			var node = event.source;
			this.deselectAllNodes();
		}
		if(event.type=='connection.start'){
			var source = event.source;
			this.connectionMode = true;
			var conn = new GraphicNodeConnection(source,this);
			this.registerConnector(conn);
			this.selectConnection(conn);
			this.dragTarget = conn;
		}
		if(event.type=='connection.end'){
			if(this.connectionMode && this.selectedConnection!=null){
				var target = event.source;
				this.deregisterConnector(this.selectedConnection);
				var cmd = new Command('Create Connnection');
				cmd.manager = this;
				cmd.source = this.selectedConnection.source;
				cmd.target = target;
				cmd.execute = function(){
					this.connection = new GraphicNodeConnection(this.source,this.target);
					this.manager.registerConnector(this.connection);
					this.manager.repaint();
				}
				cmd.undo = function(){
					this.manager.deregisterConnector(this.connection);
					this.connection.setSource(null);
					this.connection.setTarget(null);
					this.manager.repaint();
					this.manager.fireEvent({"type": "connection.deleted","source": this.target});
				}
				cmd.redo = function(){
					this.execute();
					this.manager.fireEvent({"type": "connection.restored","source": this.target});
				}
				this.selectedConnection.setSource(null);
				this.selectConnection(null);
				this.stack.execute(cmd);
			}
			this.connectionMode = false;
			this.dragTarget = null;
		}
		if(event.type=='connection.selected'){
			var connection = event.source;
			this.selectConnection(connection);
		}
		this.fireEvent(event);
	}
}

GraphicalEditor.prototype.resize = function(){
	this.gcManager.resize($('#'+this.parentId).width(),$('#'+this.parentId).height());
}

GraphicalEditor.prototype.getPalette = function(){
	return this.gcManager.palette;
}

GraphicalEditor.prototype.setListener = function(eventListener){
	this.gcManager.eventListener = eventListener;
}

GraphicalEditor.prototype.getCommandStack = function(){
	return this.commandStack;
}

GraphicalEditor.prototype.init = function(callback){
	var manager = this.gcManager;
	iconLoader.onReadyState = function(){
		manager.init();
		if(callback){
			callback();
		}
	}
	iconLoader.load();
}

GraphicalEditor.prototype.saveModel = function(onModelSaved){
	var serializedModel = this.serializeModel();
	console.log(serializedModel);
	if(onModelSaved){
		onModelSaved();
	}
}

GraphicalEditor.prototype.save = function(onEditorSaved){
	var editor = this;
	this.saveModel(function(){
		editor.commandStack.clear();
		if(onEditorSaved){
			onEditorSaved();
		}
	});
}

GraphicalEditor.prototype.serializeModel = function(){
	var model = { "nodes": [], "connections": [] };
	for(var nodeId in this.gcManager.nodeCache){
		var node = this.gcManager.nodeCache[nodeId];
		var serializedNode = node.serialize();
		model.nodes.push(serializedNode);
	}
	for(var connId in this.gcManager.connectorCache){
		var connection = this.gcManager.connectorCache[connId];
		var serializedConn = connection.serialize();
		model.connections.push(serializedConn);
	}
	return model;
}

GraphicalEditor.prototype.loadModel = function(model){
	var nodeByIds = {};
	var elemntCount = 0;
	for(var i=0;i<model.nodes.length;i++){
		var serializedNode = model.nodes[i];
		var factory = this.gcManager.getFactory(serializedNode.type);
		if(factory){
			var node = factory.createNode();
			node.id = serializedNode.id;
			node.setLocation(serializedNode.x,serializedNode.y,this.gcManager.gridSize);
			node.properties = serializedNode.properties;
			this.gcManager.registerNode(node);
			nodeByIds[serializedNode.id] = node;
			elemntCount++;
		}else{
			showWarning('No factory found for node type '+serializedNode.type);
		}
	}
	for(var i=0;i<model.connections.length;i++){
		var connection = model.connections[i];
		var startIds = connection.source.split('#');
		var endIds = connection.target.split('#');
		var startNode = nodeByIds[startIds[0]];
		var endNode = nodeByIds[endIds[0]];
		if(startNode && endNode){
			var startTerminal = startNode.terminals[startIds[1]];
			var endTerminal = endNode.terminals[endIds[1]];
			if(startTerminal && endTerminal){
				var conn = new GraphicNodeConnection(startTerminal,endTerminal);
				this.gcManager.registerConnector(conn);
				elemntCount++;
			}else{
				showError('Unable to restore connection #'+i+': terminal not found');
			}
		}else{
			showError('Unable to restore connection #'+i+': boundary node not found');
		}
	}
	if(elemntCount>0){
		this.gcManager.repaint();
	}
}

GraphicalEditor.prototype.refresh = function(){
	this.gcManager.repaint();
}