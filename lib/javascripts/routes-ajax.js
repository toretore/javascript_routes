//Michael Schuerig

Route.Object = function (url) {
  this.url = url;
};

Route.Object.prototype = {
  toString: function() { return this.url; }
};


//Replace Route.prototype.generate
(function(oldGenerate){

  Route.prototype.generate = function(){
    var path = oldGenerate.apply(this, arguments);
    return path && new Route.Object(path);
  };

})(Route.prototype.generate);


if (window.Prototype) {
  Object.extend(Route.Object.prototype, {
    get:      function(options) { this.method = 'get';    return this.request(options) },
    post:     function(options) { this.method = 'post';   return this.request(options) },
    put:      function(options) { this.method = 'put';    return this.request(options) },
    'delete': function(options) { this.method = 'delete'; return this.request(options) },
    request:  function(options) {
      var result = this;
      options = options || {};
      var async = $H(options).any(function(p) { return /^on[A-Z1-5]/.test(p[0]); });
      options = Object.extend({ asynchronous: async, method: this.method }, options);
      if (!async) {
        options.onComplete = function(r) { result = r.responseText; };
      }
      new Ajax.Request(this.url, options);
      return result;
    }
  });
}
