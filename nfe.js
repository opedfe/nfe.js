
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
		version:'1.1.1',
		cache:{},
		config:{
			debug:false,
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
	var isOldWebKit = +navigator.userAgent.replace(/.*AppleWebKit\/(\d+)\..*/, '$1') < 536;
	var	head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;

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
		var loc = window.location;
		//return window.location.origin + id;
		return loc.protocol + '//' + loc.host + id;
	}

	function triggerCallback(url){
		util.each(nfe.cache, function(meta, path){
			if(url === path){
				util.each(meta.callback, function(fn, idx){
					fn.call(global, url);
				});
				meta.callback = [];
				return false;
			}
		});	
	}

var currentlyAddingScript
var interactiveScript
function getCurrentScript() {
  if (currentlyAddingScript) {
    return currentlyAddingScript
  }

  // For IE6-9 browsers, the script onload event may not fire right
  // after the script is evaluated. Kris Zyp found that it
  // could query the script nodes and the one that is in "interactive"
  // mode indicates the current script
  // ref: http://goo.gl/JHfFW
  if (interactiveScript && interactiveScript.readyState === "interactive") {
    return interactiveScript
  }

  var scripts = head.getElementsByTagName("script")

  for (var i = scripts.length - 1; i >= 0; i--) {
    var script = scripts[i]
    if (script.readyState === "interactive") {
      interactiveScript = script
      return interactiveScript
    }
  }
}

	function load(meta, iCallback){
        
		var url = meta.uri;
		var callback = triggerCallback;
		meta = getMeta(meta.id, meta.uri);
		meta.callback.push(iCallback);
		//正在加载中，不需要重复加载
		if(meta.stat === 1){
			return;
		}
		//如果没有加载过，标记为加载中
		if(typeof meta.stat === 'undefined'){
			meta.stat = 1;
		}
        nfe.cache[meta.uri] = meta;
		
		//如果已经加载过，则直接完成
		if(meta.stat === 2){
			callback.call(this, url);
			return;
		}
		/**
        if(typeof nfe.cache[meta.uri] !== 'undefined'){
            callback.call(this, url);
            return;
        }else{
			meta.callback = iCallback;
		}
		*/
        //nfe.cache[meta.uri] = meta;
        debug(1, '[load] url:' + url);
		var type = util.fileType(url),
			isJs = type === 'js',
			isCss = type === 'css',
			node = document.createElement(isJs ? 'script' : 'link'),
			supportOnload = 'onload' in node,
			tid = setTimeout(onerror, (nfe.config.timeout || 15) * 1000),
			intId, intTimer;
		node.charset = 'utf-8';
		if(isJs){
			node.type = 'text/javascript';
			node.async = true;
			if(nfe.config.debug){
				node.src = url + '?_=' + (new Date()).getTime();
			}else{
				node.src = url;
			}
		}else if(isCss){
			node.type = 'text/css';
			node.rel = 'stylesheet';
			if(nfe.config.debug){
				node.href = url + '?_=' + (new Date()).getTime();
			}else{
				node.href = url;
			}
		}
		node.onload = node.onreadystatechange = function(){
			if(node && (!node.readyState || /loaded|complete/.test(node.readyState))){
				clearTimeout(tid);
				node.onload = node.onreadystatechange = null;
				if(isJs && head && node.parentNode){
					head.removeChild(node);
                    if(anonymousMeta){
						var _meta = getMeta(meta.id, meta.uri, 2);
						for(var key in anonymousMeta){
							_meta[key] = anonymousMeta[key];
						}
                        //anonymousMeta.id = meta.id;
                        save(meta.uri, _meta);
                        anonymousMeta = null;
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

		function onerror(){
			clearTimeout(tid);
			clearInterval(intId);
			console.error('Error for load resource: ' + url);
			//throw new Error('Error for load url: ' + url);
			callback.call(this, url);
		};

		node.onerror = onerror;

  		currentlyAddingScript = node
		head.appendChild(node);
  		currentlyAddingScript = null;
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

	function getMeta(id, path, stat){
		var meta = nfe.cache[path];
		if(meta){
			if(typeof stat !== 'undefined'){
				meta.stat = stat;
			}
		}else{
			meta = {
				id:id,
				uri:path,
				callback:[],
				stat:stat
			};
		}
		return meta;
	}

	nfe.use = function(ids, callback){
		if(util.isString(ids)){
			ids = [ids];
		}
        ids = ids.concat(nfe.config.preload);
        var metas = [];
        for(var i=0; i<ids.length; i++){
            var path = toURL(ids[i]);
			/**
            metas[i] = {
                id:ids[i],
				uri:path
            };
			*/
			metas[i] = getMeta(ids[i], path);
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
				r.async = function(ids, callback){
					if(util.isString(ids)){
						ids = [ids];
					}
					var metas = [];
					for(var i=0; i<ids.length; i++){
						var _id = uri.join(uri.dirname(id), ids[i]);
						var path = toURL(_id);
						/**
						metas[i] = {
							id:_id,
							uri:path
						};
						*/
						metas[i] = getMeta(_id, path);
					}
					Loader.run(metas, callback || function(){});
				};
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

		/**
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
				metas[i] = getMeta(nid, path);
            }
			// 如果id不存在，则延迟处理，到onload中
			if(id !== null){
				var guid = getQueueIdByUri(toURL(id));
		    	Loader.push(guid, metas);
			}else{
				delayMetas = metas;
			}
        }
		*/
		/**
        var meta = {
            id:id,
            factory:factory,
			deps:deps,
			anonymous:id === null
        };
		*/
		var meta = {};
		if(id !== null){
			meta = getMeta(id, toURL(id), 2);
		}else{
			var script = getCurrentScript();
			if(script){
				var uri = script.src.replace(/\?.+$/, '');
				meta = getMeta(id, uri, 2);
			}
		}
		meta.factory = factory;
		meta.deps = deps;
		meta.anonymous = id === null;

		if(meta.uri){
            save(meta.uri, meta);
		}else{
            anonymousMeta = meta;
		}
	}

    function save(url, meta){
        
        debug(1, '[define] ' + url);
        var url = url || meta.uri;
        debug(1, '[cache] ' + url);
		//var tmp = nfe.cache[url];
		//meta.id = tmp.id;
		//meta.callback = tmp.callback;
		nfe.cache[url] = meta;

		var id = meta.id;
		var deps = meta.deps;
        if(deps.length > 0){
            var metas = [];
			var root = id ? uri.dirname(id) : meta.uri;
            for(var i=0; i<deps.length; i++){
				var nid = uri.join(root, deps[i]);
				var path = toURL(nid);
				metas[i] = getMeta(nid, path);
            }
			var guid = getQueueIdByUri(url);
			Loader.push(guid, metas);
        }
    }

	var load_queue = {};

	function getQueueIdByUri(url){
		var ret = '';
		util.each(load_queue, function(queue, key){
			util.each(queue, function(meta, idx){
				if(meta.uri === url){
					ret = key;
					return false;
				}
			});
		});
		return ret;
	}

	var Loader = {
		callbacks:{},
		push:function(guid, metas, callback){
			var me = this;
			if(typeof callback !== 'undefined'){
				me.callbacks[guid] = callback;
			}
			load_queue[guid] = load_queue[guid].concat(metas);

			/**
			 * 异步延时处理，等待页面中的define全部都执行完毕
			 * 否则，后面的依赖文件会被重新加载，失去了合并的意义
			 */
			setTimeout(function(){
				util.each(metas, function(meta, index){
					load(meta, function(url){
						debug(1, '[loaded] url:' + url);
						var queue = load_queue[guid];
						util.each(queue, function(meta, idx){
							if(meta.uri === url){
								queue.splice(idx, 1);
								return false;
							}
						});
						if(queue.length === 0){
							me.callbacks[guid].call();
						}
					});
				});
			}, 0);
		},
		run:function(metas, callback){
			var me = this;
			var guid = util.guid();
			load_queue[guid] = [];
			me.push(guid, metas, function(){
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

	global.queue = load_queue;

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
