
define("test/modules/sumod/subdep", [], function(require, exports, module){
    
	exports.config = {
		name:"subdep"
	};
    exports.init = function(){
        console.log('subdep init');
    };
});