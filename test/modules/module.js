define(function(require, exports, module){
	var dep = require('./dep');
	
	var $ = require('jqueryui');
    dep.init();
	exports.obj = {
		name:"module-name"
	};
	exports.clickwin = function(){
		require.async(['./async', './dep'], function(a, b){
			console.log(a);
			console.log(b);
		});
		require.async(['./async', './dep'], function(a, b){
			console.log(a);
			console.log(b);
		});
	};

    exports.init = function(){
		var me = this;
		document.onclick = function(){
			console.log('click');
			me.clickwin();
		}
        console.log(this.obj.name);
		console.log($);
		console.log($('body'));
    };
});
