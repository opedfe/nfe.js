define("module", ["./dep", "./module.css"], function(require, exports, module){
	var dep = require('./dep');
	
    dep.init();
	exports.obj = {
		name:"module"
	};

    exports.init = function(){
        console.log(this.obj.name);
    };
});
