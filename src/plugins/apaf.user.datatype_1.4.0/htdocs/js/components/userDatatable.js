/*
 * userDatatable.js - APAF UserDatatable component: a DatatableV2 specialized for user datatype records
 * Adds lexicographic column sorting (click on a column header) and single-line cells.
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const USER_DATATABLE_DEPTS = [
	{"type": "css","uri": "/apaf-user-datatype-ui/css/userDatatable.css"}
];

/*
 * apaf.UserDatatable extends apaf.DatatableV2 (provided by the apaf.statics plugin): make sure the
 * parent class is available before it is referenced
 */
(function(){
	if(typeof apaf.DatatableV2=='undefined'){
		let componentDef = npaUi.componentMap['apaf']['DatatableV2'];
		$.ajax({"url": componentDef.dependency,"dataType": "script","async": false});
		componentDef.loaded = true;
	}
})();

/*
 * Sorts the items on the (lexicographic) string value of one field. Without active column, the
 * order of the fallback sorter (the one defined by the "sorter" configuration entry) is preserved.
 */
class UserDatatableSorter extends ItemSorter {
	fallbackSorter = null;
	fieldName = null;
	ascending = true;
	collator = new Intl.Collator(navigator.language);
	constructor(configuration,fallbackSorter){
		super(configuration);
		this.fallbackSorter = fallbackSorter;
	}
	setOrder(fieldName,ascending){
		this.fieldName = fieldName;
		this.ascending = ascending;
	}
	sortKey(item){
		let value = item[this.fieldName];
		if(typeof value=='undefined' || value==null){
			return '';
		}
		return typeof value=='object'?JSON.stringify(value):String(value);
	}
	sort(itemList){
		let list = this.fallbackSorter.sort(itemList);
		if(this.fieldName==null){
			return list;
		}
		let sorter = this;
		let direction = this.ascending?1:-1;
		return list.map(function(item){
			return {"item": item,"key": sorter.sortKey(item)};
		}).sort(function(a,b){
			return direction*sorter.collator.compare(a.key,b.key);
		}).map(function(entry){
			return entry.item;
		});
	}
}

/*
 * Same configuration as apaf.DatatableV2
 */
apaf.UserDatatable = class UserDatatable extends apaf.DatatableV2{
	filterExpr = '';
	initialize(then){
		loadDeps(USER_DATATABLE_DEPTS,() => {
			super.initialize(() => {
				this.itemSorter = new UserDatatableSorter({},this.itemSorter);
				then();
			});
		});
	}
	render(then){
		super.render(() => {
			this.enableColumnSorting();
			if(then){
				then();
			}
		});
	}
	enableColumnSorting(){
		let datatable = this;
		let columns = this.getConfiguration().columns;
		$('#'+this.getId()+'_table thead th').each(function(index){
			let column = columns[index];
			if(column && 'field'==column.type){
				$(this).addClass('userDatatableSortable')
				       .off('click.'+datatable.getId())
				       .on('click.'+datatable.getId(),function(){
							datatable.sortOn(column.name);
					   });
			}
		});
	}
	sortOn(fieldName){
		let sorter = this.itemSorter;
		sorter.setOrder(fieldName,sorter.fieldName==fieldName?!sorter.ascending:true);
		let columns = this.getConfiguration().columns;
		$('#'+this.getId()+'_table thead th').each(function(index){
			let column = columns[index];
			$(this).removeClass('userDatatableSortAsc userDatatableSortDesc');
			if(column && 'field'==column.type && column.name==fieldName){
				$(this).addClass(sorter.ascending?'userDatatableSortAsc':'userDatatableSortDesc');
			}
		});
		this.renderData(this.dataset);
		this.applyFilter(this.filterExpr);
	}
	renderData(data){
		super.renderData(data);
		this.enableCellTooltips();
	}
	renderColumn(item,index,column){
		let html = super.renderColumn(item,index,column);
		if('action'!=column.type){
			html = html.replace(/^<td/,'<td class="userDatatableCell"');
		}
		return html;
	}
	/*
	 * the full text of a truncated cell is made available as a tooltip
	 */
	enableCellTooltips(){
		let table = $('#'+this.getId()+'_table');
		table.off('mouseover.userDatatableCell');
		table.on('mouseover.userDatatableCell','td.userDatatableCell',function(){
			let cell = this;
			if(cell.scrollWidth>cell.clientWidth){
				cell.title = $(cell).text();
			}else{
				cell.removeAttribute('title');
			}
		});
	}
	applyFilter(filterExpr){
		this.filterExpr = filterExpr;
		super.applyFilter(filterExpr);
	}
}
