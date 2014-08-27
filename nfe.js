
/**
 * nfe 模块化加载器
 * @author lifayu@baidu.com
 * @since 2014-08-13
 *         ___           ___           ___     
 *        /\__\         /\  \         /\  \    
 *       /::|  |       /::\  \       /::\  \   
 *      /:|:|  |      /:/\:\  \     /:/\:\  \  
 *     /:/|:|  |__   /::\~\:\  \   /::\~\:\  \ 
 *    /:/ |:| /\__\ /:/\:\ \:\__\ /:/\:\ \:\__\
 *    \/__|:|/:/  / \/__\:\ \/__/ \:\~\:\ \/__/
 *        |:/:/  /       \:\__\    \:\ \:\__\  
 *        |::/  /         \/__/     \:\ \/__/  
 *        /:/  /                     \:\__\    
 *        \/__/                       \/__/    
 */


(function(global){
	
	var console = global.console || {
		log:function(){},
		info:function(){},
		error:function(){},
		debug:function(){}
	};

	var nfe = {
		version:'1.1.0',
		cache:{},
		config:{
			timeout:15,
			base:'',
			preload:[],
			alias:{},
			paths:{}
		}
	};
	var uri = {};

    /**
     * URI拼接
     * uri.join("/path", "/to/", "home", "../school", "./index.html")
     * @returns {string}
     */
    uri.join = function(/*urls*/){
       if(arguments.length === 0){
           return "";
       }
       var array = [arguments[0]];
       for(var i=1; i<arguments.length; i++){
           var arg = arguments[i];
           var sub = arg.split("/");
           if(sub[0].substr(0) !== '.'){
               array = sub;
           }else{
               array = array.concat(sub);
           }
       }
       var path = [array[0]];
       for(var j=1; j<array.length; j++){
           var part = array[j];
           if(part == ".."){
               path.pop();
           }else if(part == "."){
               //do nothing
           }else{
               path.push(part);
           }
       }
       return path.join("/");
    };
    /**
     * 获取基准目录
     * @param path
     * @returns {string}
     */
    uri.dirname = function(path){
        var parts = path.split("/");
        parts.pop();
        return parts.join("/");
    };
    /**
     * 获取最终文件名
     * @param path
     * @param ext 扩展名，(可选)，如果指定此项，返回结果会去除扩展名
     * @returns {String}
     */
    uri.basename = function(path, ext){
        return path.split("/").pop().replace(new RegExp(ext + "$"), "");
    };

	nfe.config.base = uri.dirname(window.location.pathname) + '/';

	var base_guid = 1;

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
				}
			} else if(Object.prototype.toString.call(source) === "[object Object]") {
				for(var v in source) {
					item = source[v];
					returnValue = fun.call(thisObj || source, item, v);
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
		};
	});
	//Set Config 
	nfe.setConfig = function(conf){
        util.each(conf, function(item, key){
           
            var c = nfe.config[key];
            if(typeof c === 'undefined'){
                nfe.config[key] = item;
            }else{
                if(util.isArray(c)){
                    nfe.config[key] = c.concat(item);
                }else if(util.isObject(c)){
                    for(var i in item){
                        nfe.config[key][i] = item[i];
                    }
                }else{
                    nfe.config[key] = item;
                }
            }
        });
	};

    var anonymousMeta = null;
	var delayMetas = [];
	/**
	 * 将id转换为真实的url路径
	 */
	function toURL(id){
		if(nfe.config.base.indexOf('.') == 0){
			nfe.config.base = uri.join(uri.dirname(window.location.pathname), nfe.config.base);
		}
		if(nfe.config.alias[id]){
			id = nfe.config.alias[id];	
		}
		if(!TYPE_REG.test(id)){
			id += '.js';
		}
		if(id.indexOf('/') !== 0){
			id = nfe.config.base + id;
		}
		for(var key in nfe.config.paths){
			var target = nfe.config.paths[key];
			id = id.replace(new RegExp(key), target);
		}
		if(/^http[s]?:\/\//.test(id)){
			return id;	
		}
		return window.location.origin + id;
	}

	function load(meta, callback){
        
		var url = meta.uri;
        if(typeof nfe.cache[meta.uri] !== 'undefined'){
            callback.call(this, url);
            return;
        } 
        nfe.cache[meta.uri] = meta;
        debug(1, '[load] url:' + url);
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
		}
		node.onload = node.onreadystatechange = function(){
			if(node && (!node.readyState || /loaded|complete/.test(node.readyState))){
				clearTimeout(tid);
				node.onload = node.onreadystatechange = null;
				if(isJs && head && node.parentNode){
					head.removeChild(node);
                    if(anonymousMeta){
                        anonymousMeta.id = meta.id;
                        save(meta.uri, anonymousMeta);
                        anonymousMeta = null;
                    }
					if(delayMetas.length > 0){
						var metas = [];
						util.each(delayMetas, function(dep, idx){
							var nid = uri.join(uri.dirname(meta.id), dep.id);
							var path = toURL(nid);
							metas[idx] = {
								id:nid,
								uri:path
							};
						});
						Loader.push(metas);
						delayMetas = [];
					}
					if(callback){
						callback.call(this, url);
					}
					node = null;
				}else if(isCss){
                    if(callback){
						callback.call(this, url);
					}
                }
			}
		};
		node.onerror = function onerror(){
			clearTimeout(tid);
			clearInterval(intId);
			console.error('Error for load resource: ' + url);
			//throw new Error('Error for load url: ' + url);
			callback.call(this, url);
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
                        if (callback) callback.call(this, url);
                        node = null;
                    }
                }, 20);
            }else{
                //if (callback) callback.call();
            }
        } else if (!isJs) {
            if (callback) callback.call(this, url);
        }
	}

	nfe.use = function(ids, callback){
		if(util.isString(ids)){
			ids = [ids];
		}
        ids = ids.concat(nfe.config.preload);
        var metas = [];
        for(var i=0; i<ids.length; i++){
            var path = toURL(ids[i]);
            metas[i] = {
                id:ids[i],
				uri:path
            };
        }
        //ids = transferIds(nfe.config.base, ids);
		//Loader.run(ids, callback);
        Loader.run(metas, callback);
	};

	function require(id, base){
        var nid = id;
        if(typeof base !== 'undefined'){
			//var root = getId(base);
            nid = uri.join(uri.dirname(base), nid);
        }
		var url = toURL(nid);
        
        var meta = nfe.cache[url];
        if(typeof meta === 'undefined'){
            throw new Error('Not find Module: ' + '(' + nid + ')' + id);
        }

		debug(3, '[require] url: (' + nid + ')' + url);
		if(typeof meta.exports !== 'undefined'){
			return meta.exports;
		}else{
			var factory = meta.factory;

			var module = {
				id:nid,
				uri:url
			};
			module = meta;
			module.exports = {};

			var parentId = id;
			if(meta.anonymous || id.indexOf('.') === 0){
				parentId = nid;
			}
			
			if(typeof factory === 'function'){
				var r = function(iid){
					return require(iid, parentId);
				};
				/*
				r.async = function(ids, callback){
					if(util.isString(ids)){
						ids = [ids];
					}
					var metas = [];
					for(var i=0; i<ids.length; i++){
						var path = toURL(ids[i]);
						metas[i] = {
							id:ids[i],
							uri:path
						};
					}
					Loader.run(metas, callback || function(){});
				};
				*/
				var result = factory.call(global, r, module.exports, module);
				if(typeof result === 'undefined'){
					meta.exports = module.exports;
					return module.exports;
				}else{
					meta.exports = result;
					return result;
				}
			}
		}
	}

	var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g
	var SLASH_RE = /\\\\/g

	function parseDependencies(code) {
	  var ret = []

	  code.replace(SLASH_RE, "")
		  .replace(REQUIRE_RE, function(m, m1, m2) {
			if (m2) {
			  ret.push(m2)
			}
		  })

	  return ret
	}

	function define(id, deps, factory){
        if(arguments.length == 1){
            factory = id;
			//分析依赖
			deps = parseDependencies(factory.toString());
            id = null;
        }else if(arguments.length == 2){
			factory = deps;
			if(util.isArray(id)){
				deps = id;
				id = null;
			}else{
				id = id;
				//分析依赖
				deps = parseDependencies(factory.toString());
			}
		}

        if(deps.length > 0){
            var metas = [];
            for(var i=0; i<deps.length; i++){
				var nid, path;
				if(id === null){
					nid = deps[i];
				}else{
					nid = uri.join(uri.dirname(id), deps[i]);
					path = toURL(nid);
				}
				metas[i] = {
					id:nid,
					uri:path
				};
            }
			// 如果id不存在，则延迟处理，到onload中
			if(id !== null){
		    	Loader.push(metas);
			}else{
				delayMetas = metas;
			}
        }
        var meta = {
            id:id,
            factory:factory,
			deps:deps,
			anonymous:id === null
        };
        if(id !== null){   
            save(toURL(id), meta);
        }else{
            anonymousMeta = meta;
        }
	}

    function save(uri, meta){
        
        debug(1, '[define] ' + uri);
        var uri = uri || meta.uri;
        debug(1, '[cache] ' + uri);
		nfe.cache[uri] = meta;
    }

	var Loader = {
		size:0,
		callback:function(){},
		push:function(metas, callback){
			var me = this;
			if(typeof callback != 'undefined'){
				me.callback = callback;
			}
			me.size += metas.length;
			util.each(metas, function(meta, index){
                load(meta, function(url){
                    debug(1, '[loaded] url:' + url);
                    me.size--;		
                    if(me.size === 0){
                        me.callback.call();
                    }
                });
			});
		},
		run:function(metas, callback){
			var me = this;
			me.push(metas, function(){
                debug(3, 'load resources finished!');
				var args = [];
				util.each(metas, function(meta, j){
					if(!/\.(css|less)(?=[?&,]|$)/.test(meta.id)){
						args.push(require(meta.id));
					}
				});
				callback.apply(global, args);
			});
		}
	};

	define.cmd = {};
	global.nfe = nfe;
	global.define = define;

	global.__require = require;

    var level = 0;
    function debug(lv, msg){
        if(lv < level){
            var d = new Date();
			if(util.isString(msg)){
            	console.log(msg + ' - ' + d.getTime());
			}else{
				console.log(msg);
			}
        }
    }
})(this);
