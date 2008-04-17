(function(){

  var iterate = function(o, fn){
    if (typeof o.length === 'number') {//Array
      for (var i = 0; i < o.length; i++) {
        //Stop iterating if return value is false
        if (fn(o[i], i, o) === false){ return false; }
      }
      return true;//All done
    } else {//Object
      for (var p in o){
        if (o.hasOwnProperty(p)) {
          fn(p, o[p]);
        }
      }
    }
  };

  var all = function(arr, fn){
    var allTrue = true;
    iterate(arr, function(e,i,a){
      if (!fn(e,i,a)) { allTrue = false; return false; }
    });
    return allTrue;
  };

  var extend = function(target, source){
    iterate(source, function(k,v){ target[k] = v; });
    return target;
  };

  var merge = function(t,s){
    var rv = {};
    extend(rv, t);
    extend(rv, s);
    return rv;
  };

  var Route = function(segments, params, name){
    this.segments = segments || [];
    this.params = params || {};
    this.name = name;
  };
  
  Route.prototype = {
    generate: function(pa, op){
      var options = merge(Routes.defaultOptions, op || {});
      var params = options.noDefaults ? merge({}, pa || {}) : merge(Routes.defaultParams, pa || {});

      var path = '';
      
      var hasParam = false;
      var routeMatch = true;
      iterate(this.params, function(k,v){
        hasParam = false;
        if (
          (typeof v === 'string' && v === params[k]) ||
          ((v.constructor === RegExp) && (new RegExp('^'+v.source+'$')).test(params[k]))
        ) {
          hasParam = true;
          delete params[k];
        }
        if (!hasParam) {
          routeMatch = false;
          return;
        }
      });
      
      if (!routeMatch) {
        return false;
      }
      
      try {
        iterate(this.segments, function(segment, index, segments){
          switch (segment.type) {
            case 'divider':
              path = path + segment.value;
              break;
            case 'static':
              path = path + segment.value;
              break;
            case 'dynamic':
              if (params[segment.value]) {
                path = path + params[segment.value];
                delete params[segment.value];
              } else if (!segment.optional) {
                throw 'nomatch';
              } else {
                delete params[segment.value];
                throw 'done';
              }
              break;
            case 'path':
              if (params[segment.value]) {
                if (params[segment.value] instanceof Array) {
                  path = path + params[segment.value].join('/');
                } else {
                  path = path + (params[segment.value] || '');
                }
                delete params[segment.value];
              } else if (!segment.optional) {
                throw 'nomatch';
              } else {
                delete params[segment.value];
                throw 'done';
              }
              break;
          }
        });
      } catch (e) {
        if (e !== 'done') { //done == don't append any more segments
          if (e === 'nomatch') { //params don't match this route
            return false;
          } else {
            throw e;
          }
        }
      }
      
      if (!options.includeSlash && path.match(/.+\/$/)) {
        path = path.slice(0,-1);
      }
      
      if (!options.onlyPath) {
        var portString = options.port ? ':'+options.port : '';
        path = [options.protocol, options.host, portString, path].join('')
      }
      
      var leftOvers = [];
      iterate(params, function(k,v){
        leftOvers.push(k + '=' + v);
      });
      
      if (leftOvers.length > 0) {
        path = path + '?' + leftOvers.join('&');
      }
      
      if (options.escape) {
        path = encodeURI(path);
      }
      
      return path;
    },
    
    toString: function(){
      return this.segments.join('');
    }
  };
  


  Route.Segment = function(value, type, optional){
    this.value = value;
    this.type = type || 'static';
    this.optional = (typeof optional === 'boolean' ? optional : true);
  };
  
  Route.Segment.prototype = {
    isDynamic: function(){
      return this.type === 'dynamic' || this.type === 'path';
    },
    toString: function(){
      if (this.type === 'dynamic') {
        return ':'+this.value;
      } else if (this.type === 'path') {
        return '*'+this.value;
      } else {
        return this.value;
      }
    },
    equal: function(other){
      return other.constructor === this.constructor && other.value === this.value &&
        other.type === this.type && other.optional === this.optional; 
    }
  };

  Route.createSegment = function(s, optional){
    if (s.match(/^[\/;?.]$/)) {
      return new Route.Segment(s, 'divider', optional);
    } else if (s.indexOf(':') === 0) {
      return new Route.Segment(s.slice(1), 'dynamic', optional);
    } else if (s.indexOf('*') === 0) {
      return new Route.Segment(s.slice(1), 'path', optional);
    } else {
      return new Route.Segment(s, 'static', optional);
    }
  };
  Route.S = Route.createSegment;

  var Routes = [];
  Routes.named = [];
  Routes.defaultParams = {action:'index'};//Default parameters for route generation
  Routes.defaultOptions = {//Defaults for second parameter
    escape: true,
    port: window.location.port,
    protocol: window.location.protocol+'//',
    host: window.location.hostname
  };
  
  Routes.extractNamed = function(){
    var route;
    for (var i = 0; i < this.length; i++) {
      route = this[i];
      if (route.name) {
        this.named.push(route);
        this.named[route.name] = route;
        
        this[route.name] = (function(route){
          var fn = function(){
            var params = {},
                options = {},
                count;
            
            //Add defaults from route
            for (var p in route.params) {
              if (route.params.hasOwnProperty(p) && route.params[p].constructor !== RegExp) {
                params[p] = route.params[p];
              }
            }
            
            //Allows Routes.name('foo', 'bar', {opts}) or Routes.name({foo:'foo', bar:'bar'}, {opts})
            if (typeof arguments[0] === 'object' && !(arguments[0] instanceof Array)) {
              extend(params, arguments[0]);
              options = arguments[1];
            } else {
              if (typeof arguments[arguments.length-1] === 'object') {
                options = arguments[arguments.length-1];
              }
              
              var count = 0;
              for (var i=0; i < route.segments.length; i++) {
                if (route.segments[i].isDynamic()) {
                  if (arguments.length > count) { params[route.segments[i].value] = arguments[count]; }
                  count++;
                }
              }
            }
            
            return route.generate(params, options);
          };

          //Routes.name.toParams() => {...}
          //Like hash_for_x in Rails, kind of
          fn.toParams = function(params){
            return merge(route.params, params || {});
          };

          return fn;
        })(route); //Pass the route to keep it in scope

      }
    }
  };
  
  Routes.generate = function(params, options){
    params = params || {};
    var path;
    for (var i = 0; i < this.length; i++) {
      path = this[i].generate(params, options);
      if (path) {
        return path;
      }
    }
    return false;
  };
  
  Routes.named.toString = Routes.toString = function(){
    return this.join(', ');
  };
  

  window['Route'] = Route;
  window['Routes'] = Routes;

})();
