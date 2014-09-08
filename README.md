模块化使用规范(nfe.js)
======

nfejs遵循CMD规范
```js
define(id?, deps?, function(require, exports, module){
     //todo something
});
```

###ID定义规范：

在编码过程中，统一使用匿名模块化，即：`define(function(require, exports, module){});`

然后使用打包工具，自动加入id和依赖

如果使用nfe打包，则直接按node编码方式进行编码，不需要`define`包装，交由`nfe`处理

其中新增两个关键字，谨慎使用（exports, module）


*加载外部依赖*，使用绝对路径
*加载内部依赖*，使用相对路径（基于相对路径，可以做自动合并）

相对依赖的id确认：基于当前模块的id，而不是模块的路径

如：
```js
define('a/b/c', function(require, exports, module){
     require('./d'); //这里d的id则为a/b/d
});
```

然后通过alias匹配对应的真实路径，接着通过paths做路径映射，如果得到的真实路径为URL，则之间返回，否则真实路径为baseUrl + id + '.js'

####匹配流程：

`id -> alias[id] -> paths -> url`

相对依赖关系只和id有关，与真实url无关

nfe.use中，不允许出现相对路径

####QA：

- 加载外部依赖，如何确定id？
     >如果设置了alias，则id为alias中对应的key值（建议），否则id为应用路径

- 加载内部依赖，如何确定id？
     >从文件的绝对路径中去除掉baseUrl之后的剩余部,
     如：
     a.js 位于 /static/js/home/a.js中，其中
     baseUrl: /static/js/
     则该文件的id为：'home/a'


- 外部依赖的子依赖如何确定id？
     >不允许外部依赖出现子依赖，如果存在，则提前合并到主程序中。
