/**
 * nfe 模块化加载器
 * @author lifayu@baidu.com
 * @since 2014-08-13
 */
(function(global, undefined){
	var nfe = {};
	nfe.version = '1.0.0';

	var base_guid = 10000;
	nfe.config = {
		timeout:15,
		base:'',
		alias:{}
	};

	nfe.config.base = window.location.pathname;
	nfe.cache = {};

	var util = nfe.util = {
		guid:function(){
			return 'NFE_' + (base_guid++).toString(36);
		},
		each:function(source, fun, thisObj){
			var returnValue, item;
			if(Object.prototype.toString.call(source) === "[object Array]") {
				for(var i = 0; i < source.length; i++) {
					item = source[i];
					returnValue = fun.call(thisObj || source, item, i);
					if(returnValue === false) {
						break;
					}
				};
			} else if(Object.prototype.toString.call(source) === "[object Object]") {
				for(var i in source) {
					item = source[i];
					returnValue = fun.call(thisObj || source, item, i);
					if(returnValue === false) {
						break;
					}
				}
			} else {
				return source;
			}
		}
	};
    var TYPE_REG = /\.(js|css)(?=[?&,]|$)/i;
    util.fileType = function(str) {
        var ext = 'js';
        str.replace(TYPE_REG, function (m, $1) {
            ext = $1;
        });
        if (ext !== 'js' && ext !== 'css') ext = 'unknown';
        return ext;
    };
	util.each(["Array", "Boolean", "Date", "Number", "Object", "RegExp", "String", "Window", "HTMLDocument"], function(item, i) {
		nfe.util["is" + item] = function(args) {
			return Object.prototype.toString.call(args) === "[object " + item + "]";
		}
	});
	//Set Config 
	nfe.setConfig = function(conf){
	};

	function getId(id){
		if(nfe.config.alias[id]){
			id = nfe.config.alias[id];
		}
		if(!TYPE_REG.test(id)){
			id += '.js';
		}
		return nfe.config.base + id;
	}

	function load(url, callback){
		var type = util.fileType(url),
			isJs = type === 'js',
			isCss = type === 'css',
			isOldWebKit = +navigator.userAgent.replace(/.*AppleWebKit\/(\d+)\..*/, '$1') < 536,
			head = document.head,
			node = document.createElement(isJs ? 'script' : 'link'),
			supportOnload = 'onload' in node,
			tid = setTimeout(onerror, (nfe.config.timeout || 15) * 1000),
			intId, intTimer;
		if(isJs){
			node.type = 'text/javascript';
			node.async = 'async';
			node.src = url;
		}else if(isCss){
			node.type = 'text/css';
			node.rel = 'stylesheet';
			node.href = url;
		}else{
			return;
		}
		node.onload = node.onreadystatechange = function(){
			if(node && (!node.readyState || /loaded|complete/.test(node.readyState))){
				clearTimeout(tid);
				node.onload = node.onreadystatechange = null;
				if(isJs && head && node.parentNode){
					head.removeChild(node);
					if(callback){
						callback.call();
					}
					node = null;
				}
			}
		};
		node.onerror = function onerror(){
			clearTimeout(tid);
			clearInterval(intId);
			throw new Error('Error for load url: ' + url);
		};
		head.appendChild(node);
        if (isCss) {
            if (isOldWebKit || !supportOnload) {
                intTimer = 0;
                intId = setInterval(function () {
                    if ((intTimer += 20) > options.timeout || !node) {
                        clearTimeout(tid);
                        clearInterval(intId);
                        return;
                    }
                    if (node.sheet) {
                        clearTimeout(tid);
                        clearInterval(intId);
                        if (callback) callback.call();
                        node = null;
                    }
                }, 20);
            }
        } else if (!isJs) {
            if (callback) callback.call();
        }
	}

	nfe.use = function(ids, callback){
		if(util.isString(ids)){
			ids = [ids];
		}
		Loader.run(ids, callback);
	};

	function require(id){
		var url = getId(id);
		var module = {};
		module.exports = {};
		var r = function(id){
			require.call(this, id);
		};
		return nfe.cache[url].call(this, r, module.exports, module);
	}

	function define(id, deps, factory){
		//var module = {};
		//factory.apply(this, require, module.exports, module);
		var url = getId(id);
		nfe.cache[url] = factory;

		Loader.push(deps);
	}

	var Loader = {
		size:0,
		callback:function(){},
		push:function(ids, callback){
			var me = this;
			if(typeof callback != 'undefined'){
				me.callback = callback;
			}
			me.size += ids.length;
			util.each(ids, function(id, index){
				var url = getId(id);
				load(url, function(){
					me.size--;		
					if(me.size == 0){
						me.callback.call();
					}
				});
			});
		},
		run:function(ids, callback){
			var me = this;
			me.push(ids, function(){
				var args = [];
				util.each(ids, function(id, j){
					args.push(require(id));
				});
				callback.apply(global, args);
			});
		}
	};

	global.nfe = nfe;
	global.define = define;

})(this, undefined);
