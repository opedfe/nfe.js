
define("test/modules/dep", ["./sumod/subdep"], function(require, exports, module){
    
    var sub = require('./sumod/subdep');
    sub.init();
	exports.config = {
		name:"dep"
	};
    exports.init = function(){
        console.log('dep init');
    };
});
