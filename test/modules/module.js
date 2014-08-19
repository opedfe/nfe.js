define("test/modules/module", ["jqueryui", "./dep", "./module.css"], function(require, exports, module){
	var dep = require('./dep');
	
	var $ = require('jqueryui');
    dep.init();
	exports.obj = {
		name:"module"
	};

    exports.init = function(){
        console.log(this.obj.name);
		console.log($);
		console.log($('body'));
    };
});
