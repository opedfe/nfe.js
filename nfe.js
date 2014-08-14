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
(function(global, undefined){
	var nfe = {};
	nfe.version = '1.0.0';

    var uri = nfe.uri = {
        version:"1.0.0"
    };

    var State = {
        READY:0,
        LOADING:1,
        COMPLETED:2
    };

    var anonymousMeta = null;
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
     * 相对路径拼接，第一个参数为base uri
     * @returns {*}
     */
    uri.resolve = function(/*urls...*/){
        var numUrls = arguments.length;

        if (numUrls === 0) {
            throw new Error("resolveUrl requires at least one argument; got none.");
        }

        var base = document.createElement("base");
        base.href = arguments[0];

        if (numUrls === 1) {
            return base.href;
        }

        var head = document.getElementsByTagName("head")[0];
        head.insertBefore(base, head.firstChild);

        var a = document.createElement("a");
        var resolved;

        for (var index = 1; index < numUrls; index++) {
            a.href = arguments[index];
            resolved = a.href;
            base.href = resolved;
        }

        head.removeChild(base);

        return resolved;
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
	var base_guid = 10000;
	nfe.config = {
		timeout:15,
		base:'',
        preload:[],
		alias:{}
	};

	nfe.config.base = uri.dirname(window.location.pathname) + '/';
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

    //此处id为真实id
	function getURI(id){
		if(!TYPE_REG.test(id)){
			id += '.js';
		}
		//return nfe.config.base + id;
        return uri.resolve(nfe.config.base, id);
	}

    function getId(id){
        if(nfe.config.alias[id]){
			id = nfe.config.alias[id];
		}
        return id;
    }

	function load(meta, callback){
        
        var resId = getId(meta.id);
        var url = getURI(resId);

        if(typeof nfe.cache[meta.id] !== 'undefined'){
            callback.call(this, url);
            return;
        } 
        nfe.cache[meta.id] = meta;
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
                        save(meta.id, anonymousMeta);
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
            //ids[i] = getId(ids[i]);
            metas[i] = {
                id:ids[i],
                status:State.READY
            };
        }
        //ids = transferIds(nfe.config.base, ids);
		//Loader.run(ids, callback);
        Loader.run(metas, callback);
	};

	function require(id, base){
        var nid = id;
        if(typeof base !== 'undefined'){
            nid = uri.join(uri.dirname(base), nid);
        }
        
        var meta = nfe.cache[nid];
        if(typeof meta === 'undefined'){
            throw new Error('Not find Module: ' + nid);
        }
        var factory = meta.factory;

        nid = getId(nid);
		var url = getURI(nid);
		var module = {
            id:nid,
            uri:url
        };
        debug(3, '[require] url: ' + url);
		module.exports = {};
        
        if(typeof factory === 'function'){
            var r = function(iid){
                return require(iid, id);
            };
            r.async = function(ids, callback){
                nfe.use(ids, callback);
            };
            var result = factory.call(this, r, module.exports, module);
            debug(4, module);
            if(typeof result === 'undefined'){
                return module.exports;
            }else{
                return result;
            }
        }
	}

	function define(id, deps, factory){
        if(arguments.length == 1){
            factory = id;
            deps = [];
            id = undefined;
        }
		//var module = {};
		//factory.apply(this, require, module.exports, module);
        //id = getId(id);

        if(deps.length > 0){
            var metas = [];
            for(var i=0; i<deps.length; i++){
                metas[i] = {
                    id:uri.join(uri.dirname(id), deps[i]),
                    status:State.READY
                };
            }
		    Loader.push(metas);
        }
        var meta = {
            id:id,
            factory:factory
        };
        if(id !== undefined){   
            save(id, meta);
        }else{
            anonymousMeta = meta;
        }
	}

    function save(id, meta){
        
        debug(1, '[define] ' + id);
        var nid = id || meta.id;
		//var url = getURI(nid);
        debug(1, '[cache] ' + nid);
		nfe.cache[nid] = meta;
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
                //var id = getId(meta.id);
				//var url = getURI(id);
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
					args.push(require(meta.id));
				});
				callback.apply(global, args);
			});
		}
	};

	global.nfe = nfe;
	global.define = define;


    var level = 5;
    function debug(lv, msg){
        if(lv < level){
            var d = new Date();
            console.log(d.getTime() + ' - ' + msg);
        }
    }
})(this, undefined);
