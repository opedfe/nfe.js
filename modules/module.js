define("modules/module", ["modules/dep"], function(require, exports, module){
	var dep = require('modules/dep');
	console.log(dep);
	return {
		name:"module"
	};
});
