/*
 * basicFlowChart.js - utility library to create basic FlowChart diagrams
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 *
 * requires the /js/graphicUtils.js library
 */
 
class GenericFlowChart {
  id = null;
  gc = null;
  width = 0;
  height = 0;
  config = {
  	"backgroundColor": "#ffffff",
    "borderWidth": 10.5,
    "axisColor": "#000000",
    "axisWidth": 1,
    "lineColor": "#00ff00",
    "lineWidth": 1,
    "selectionColor": "#ff0000",
    "selectionWidth": 3,
    "textColor": "#000000",
    "textWidth": 12,
    "unit": "",
    "title": "No Title",
    "showTitle": true,
    "titleColor": "#000000",
    "titleBackground": "#ffffff",
    "titleWidth": 18,
    "titleLocation": "top",
    "showGrid": true,
    "gridSize": 10,
    "gridWidth": 1,
    "gridColor": "#d3d3d3"
  };
  eventListener = null;
  data = [];
  bounds = [];
  selectedDataIndex = -1;
  constructor(parentId,width,height,props){
    this.id = parentId+'_gfc';
    this.width = width;
    this.height = height;
    this.gc = new ReactivArea(this.id,parentId,width,height);
    this.gc.chart = this;
    if(props){
      Object.assign(this.config,props);
    }
    this.gc.background = this.config.backgroundColor;
    this.eventListener = this;
    this.gc.detectValueArea = function(x,y){
	  if(this.chart.bounds.length>0){
        this.chart.selectedDataIndex=-1;
        for(var i=0;i<this.chart.bounds.length && this.chart.selectedDataIndex==-1;i++){
          let valueArea = this.chart.bounds[i];
          if(x>=valueArea.x0 &&
             x<=valueArea.x1 &&
             y>=valueArea.y0 &&
             y<=valueArea.y1){
             this.chart.selectedDataIndex=i;
          }
        }
        if(this.chart.selectedDataIndex>=0){
          this.repaint();
        }
      }
    }
    this.gc.onMouseDown = function(mouseEvent){
      mouseEvent.target = this.chart;
      this.chart.eventListener.onEvent(mouseEvent);
    }
    this.gc.onMouseUp = function(mouseEvent){
      mouseEvent.target = this.chart;
      this.chart.eventListener.onEvent(mouseEvent);
    }
    this.gc.onMouseMove = function(mouseEvent){
	  mouseEvent.target = this.chart;
      this.detectValueArea(mouseEvent.location.x,mouseEvent.location.y);
      this.chart.eventListener.onEvent(mouseEvent);
    }
    this.gc.onKeyUp = function(keyEvent){
      keyEvent.target = this.chart;
      this.chart.eventListener.onEvent(keyEvent);
    }
    this.gc.onKeyDown = function(keyEvent){
      keyEvent.target = this.chart;
      this.chart.eventListener.onEvent(keyEvent);
    }
    this.gc.extractFlowContext = function(){
      let flowCtx = {};
      flowCtx.maxValue = Number.MIN_VALUE;
      flowCtx.minValue = Number.MAX_VALUE;
      flowCtx.minYValue = 0;
      for(var i=0;i<this.chart.data.length;i++){
        let value = this.chart.data[i];
        if(value<flowCtx.minValue){
          flowCtx.minValue = value;
        }
        if(value>flowCtx.maxValue){
          flowCtx.maxValue = value;
        }
      }
      if(flowCtx.maxValue!=0 && this.chart.data.length>1){
		flowCtx.yAxisLeftSpace = (''+flowCtx.maxValue).length*10;
		flowCtx.deltaValue = flowCtx.maxValue;
		if(flowCtx.minValue<0){
			flowCtx.minYValue = Math.floor(flowCtx.minValue*1.1);
		}else{
			flowCtx.minYValue = 0;
			if(flowCtx.minValue>100){
				flowCtx.minYValue = Math.floor(flowCtx.minValue-(flowCtx.maxValue - flowCtx.minValue)*0.1);
			}
		}
		flowCtx.deltaValue = flowCtx.maxValue - flowCtx.minYValue;
		this.chart.config.gridSize = flowCtx.deltaValue>10?Math.floor(flowCtx.deltaValue/10):1;
      	flowCtx.scaleY = (this.height-2*this.chart.config.borderWidth)/(flowCtx.deltaValue/0.85);
        flowCtx.scaleX = (this.width-2*this.chart.config.borderWidth-flowCtx.yAxisLeftSpace)/(this.chart.data.length-1);
      }
      return flowCtx;
    }
    this.gc.drawAxis = function(gc,flowCtx){
      gc.strokeStyle = this.chart.config.axisColor;
      gc.lineWidth = this.chart.config.axisWidth;
      gc.beginPath();
      gc.moveTo(this.chart.config.borderWidth+flowCtx.yAxisLeftSpace,this.chart.config.borderWidth);
      gc.lineTo(this.chart.config.borderWidth+flowCtx.yAxisLeftSpace,this.height-this.chart.config.borderWidth);
      if(flowCtx.minYValue>=0){
      	gc.lineTo(this.width-this.chart.config.borderWidth,this.height-this.chart.config.borderWidth);
      }
      gc.stroke();
      if(flowCtx.minYValue<0){
		let y = this.height-this.chart.config.borderWidth+flowCtx.minYValue*flowCtx.scaleY;
	    gc.beginPath();
	    gc.moveTo(this.chart.config.borderWidth+flowCtx.yAxisLeftSpace,y);
		gc.lineTo(this.width-this.chart.config.borderWidth,y);
		gc.stroke();
	  }
    }
    this.gc.drawData = function(gc,flowCtx){
      this.chart.bounds = [];
      if(this.chart.data.length>1){
        gc.strokeStyle = this.chart.config.lineColor;
        gc.lineWidth = this.chart.config.lineWidth;
        let x0 = this.chart.config.borderWidth+flowCtx.yAxisLeftSpace;
        let y0 = this.height-this.chart.config.borderWidth-(this.chart.data[0]-flowCtx.minYValue)*flowCtx.scaleY;
        let scaleX2 = flowCtx.scaleX/2;
        this.chart.bounds.push({"value": this.chart.data[0],
                                "x0": (x0-scaleX2),
                                "y0": (y0-scaleX2),
                                "x1": (x0+scaleX2), 
                                "y1": (y0+scaleX2),
                                "x": x0,
                                "y": y0});
        gc.beginPath();
        gc.moveTo(x0,y0);
        for(var i=1;i<this.chart.data.length;i++){
          x0 += flowCtx.scaleX;
          y0 = this.height-this.chart.config.borderWidth-(this.chart.data[i]-flowCtx.minYValue)*flowCtx.scaleY;
          this.chart.bounds.push({"value": this.chart.data[i],
                                  "x0": (x0-scaleX2),
                                  "y0": (y0-scaleX2),
                                  "x1": (x0+scaleX2), 
                                  "y1": (y0+scaleX2),
                                  "x": x0,
                                  "y": y0});
          gc.lineTo(x0,y0);
        }
        gc.lineTo(x0,this.height-this.chart.config.borderWidth);
        gc.lineTo(this.chart.config.borderWidth+flowCtx.yAxisLeftSpace,this.height-this.chart.config.borderWidth);
        gc.lineTo(this.chart.config.borderWidth+flowCtx.yAxisLeftSpace,this.height-this.chart.config.borderWidth-this.chart.data[0]*flowCtx.scaleY);
        gc.stroke();
        const lingrad = gc.createLinearGradient(this.width/2, 0, this.width/2, this.height);
        lingrad.addColorStop(0, this.chart.config.lineColor);
        lingrad.addColorStop(1, '#ffffff');
        gc.fillStyle = lingrad;
        gc.fill();
      }
    }
    this.gc.showValueArea = function(gc,scales,index){
      let valueArea = this.chart.bounds[index];
      gc.lineWidth = this.chart.config.selectionWidth;
      gc.strokeStyle = this.chart.config.selectionColor;
      gc.beginPath();
      gc.moveTo(valueArea.x-2*gc.lineWidth,valueArea.y-2*gc.lineWidth);
      gc.lineTo(valueArea.x+2*gc.lineWidth,valueArea.y-2*gc.lineWidth);
      gc.lineTo(valueArea.x+2*gc.lineWidth,valueArea.y+2*gc.lineWidth);
      gc.lineTo(valueArea.x-2*gc.lineWidth,valueArea.y+2*gc.lineWidth);
      gc.lineTo(valueArea.x-2*gc.lineWidth,valueArea.y-2*gc.lineWidth);
      gc.stroke();
      gc.fillStyle =  this.chart.config.textColor;
      let text = valueArea.value+this.chart.config.unit;
      gc.font = this.chart.config.textWidth+'px sans-serif';
      gc.textBaseline = 'top';
      let labelWidth = gc.measureText(text).width;
      //let deltaY = 10;
      //if(this.height-this.chart.config.borderWidth-valueArea.y<this.chart.config.textWidth+10){
      let deltaY = -10-this.chart.config.textWidth;
      //}
      gc.fillText(text, valueArea.x-(labelWidth/2),valueArea.y+deltaY);
    }
    this.gc.drawTitle = function(gc){
      if(this.chart.config.showTitle){
        gc.fillStyle =  this.chart.config.titleBackground;
        let x0 = this.width/2;
        let y0 = this.chart.config.borderWidth;
        gc.font = this.chart.config.titleWidth+'px sans-serif';
        gc.textBaseline = 'top';
        let titleWidth = gc.measureText(this.chart.config.title).width;
        gc.fillRect(x0-titleWidth/2-10, y0-10, titleWidth+20, this.chart.config.titleWidth+20);
        gc.fillStyle = this.chart.config.titleColor;
        gc.fillText(this.chart.config.title, x0-titleWidth/2,y0);
      }
    }
    this.gc.drawGrid = function(gc,flowCtx){
      if(this.chart.config.showGrid){
	    gc.fillStyle =  this.chart.config.textColor;
        gc.font = this.chart.config.textWidth+'px sans-serif';
        gc.textBaseline = 'top';
        gc.lineWidth = this.chart.config.gridWidth;
        gc.strokeStyle = this.chart.config.gridColor;
        let y = this.height-this.chart.config.borderWidth;
        let gridValue = flowCtx.minYValue;
        let iterationCount = 0;
        while(y>this.chart.config.borderWidth && iterationCount<100){
          gc.beginPath();
          gc.moveTo(this.chart.config.borderWidth+flowCtx.yAxisLeftSpace-5,y);
          gc.lineTo(this.width-this.chart.config.borderWidth,y);
          gc.stroke();
          gc.fillText(gridValue, this.chart.config.borderWidth,y-(this.chart.config.textWidth/2));
          y -= this.chart.config.gridSize*flowCtx.scaleY;
          gridValue += this.chart.config.gridSize;
          iterationCount++;
        }
        if(iterationCount==100){
			console.log('infinite loop detected in graph for '+this.chart.config.title);
		}
      }
    }
    this.gc.paint = function(gc){
      let flowCtx = this.extractFlowContext();
      gc.shadowOffsetX = 0;
      gc.shadowOffsetY = 0;
      gc.shadowBlur = 0;
      this.drawGrid(gc,flowCtx);
      this.drawData(gc,flowCtx);
      if(this.chart.selectedDataIndex>=0){
        this.showValueArea(gc,flowCtx,this.chart.selectedDataIndex);
      }
      this.drawAxis(gc,flowCtx);
      this.drawTitle(gc);
    }
    this.gc.init();
  }
  setEventListener(listener){
    this.eventListener = listener;
  }
  onEvent(event){
    //console.log(event);
  }
  refresh(){
    this.gc.repaint();
  }
  setData(datStructure){
    this.data = datStructure;
    this.selectedDataIndex = -1;
    this.refresh();
  }
}

window.GenericFlowChart = GenericFlowChart;