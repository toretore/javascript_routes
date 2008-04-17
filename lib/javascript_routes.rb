module JavascriptRoutes

  JS = File.join(File.dirname(__FILE__), 'javascripts', 'routes.js')
  JS_PACKED = File.join(File.dirname(__FILE__), 'javascripts', 'routes-min.js')
  JS_AJAX = File.join(File.dirname(__FILE__), 'javascripts', 'routes-ajax.js')
  FILENAME = File.join(RAILS_ROOT, 'public', 'javascripts', 'routes.js')
  FILENAME_AJAX = File.join(RAILS_ROOT, 'public', 'javascripts', 'routes-ajax.js')

  def self.generate(options = {})
    options.symbolize_keys!.reverse_merge!(:pack => true)

    routes = options[:routes] || ActionController::Routing::Routes.routes.select{|r|
      r.conditions[:method].nil? || r.conditions[:method] == :get
    }
    named_routes = options[:named_routes] || ActionController::Routing::Routes.named_routes.routes.select{|n,r|
      r.conditions[:method].nil? || r.conditions[:method] == :get
    }
    filename = options[:filename] || FILENAME
    filename_ajax = options[:filename_ajax] || FILENAME_AJAX
  
    #Will only create simple functions for named routes
    if options[:lite]
      
      File.open(filename, 'w') do |file|
        routes_object = '  var r = "{'
        named_routes.each_with_index do |a,i|
          n,r = *a
          routes_object << "#{n}: function(#{r.segments.select{|s| s.respond_to?(:key) }.map(&:key).join(', ')}){ "
          routes_object << 'return '
          
          r.segments.each_with_index do |s,j|
            if s.respond_to?(:key)
              routes_object << "'" unless i==0 || r.segments[j-1].respond_to?(:key)
              routes_object << "+#{s.key}"
            else
              routes_object << '+' if j > 0 && r.segments[j-1].respond_to?(:key)
              routes_object << "'" if j == 0 || r.segments[j-1].respond_to?(:key)
              routes_object << s.to_s unless j != 0 && j == r.segments.size-1 && s.to_s == '/'
              routes_object << "'" if j == r.segments.size-1
            end
          end
          
          routes_object << ';'
          routes_object << " }"
          routes_object << ',' if i < named_routes.size-1
        end
        routes_object << "}\";\n"
        
        #Find words with 5 or more characters that appear more than once
        words = routes_object.scan(/[a-z_]{5,}/).group_by{|s| s }.inject([]){|r,a| r << a.first if a.last.size > 1; r }
        #Replace words with placeholders
        words.each_with_index{|w,i| routes_object.gsub!(w, "$#{i}") }

        file << "var Routes = (function(){\n"
        
        #Export words to JS
        file << "  var s = [" + words.map{|w| "'#{w}'" }.join(',') + "];\n"
        file << routes_object
        #Put the words back in (using JS) and eval the result
        file << "  return eval('('+r.replace(/\\$(\\d+)/g, function(m,i){ return s[i]; })+')');\n"
        
        file << "})();"
      end
      
    #Will create all routes with generation logic (from lib/routes.js)
    else
    
      File.open(filename, 'w') do |file|
        file << File.read(options[:pack] ? JS_PACKED : JS)
        
        file << "\n\n(function(){\n\n"#Don't pollute the global namespace
      
        #This is ugly, but it works. It builds a JS array
        #with an object for each route. Most of the ugliness
        #is to reduce the amount of space it takes up.
        routes_array = ''
        routes_array << 'var r = "['
        routes.each_with_index do |r,i|
          routes_array << '{'
          
          #Append a name if this is a named route
          named_route = named_routes.find{|name,route| route.equal?(r) }
          routes_array << "n:'#{named_route.first}'," if named_route
          
          #Append segments as a string with @ between. This will
          #be split() using JS.
          routes_array << "s:'"
          routes_array << r.segments.map do |s|
            if s.is_a?(ActionController::Routing::PathSegment)
              '*' + s.to_s[1..-1] + (s.is_optional ? 't' : 'f')
            else
              s.to_s + (s.is_optional ? 't' : 'f')
            end
          end.join('@')
          routes_array << "'"
          
          #Append params object
          routes_array << ',r:{'
          routes_array << r.requirements.map do |k,v|
              "#{k}:'#{v}'"
          end.join(',')
          routes_array << '}'
          
          routes_array << '}'
          routes_array << ',' unless i == routes.size-1
        end
        routes_array << "]\";\n"
        
        #Find words that occur more than once and are more than 5 characters in length
        words = routes_array.scan(/[a-z_]{5,}/).group_by{|s| s }.inject([]){|r,a| r << a.first if a.last.size > 1; r }
        #Replace words with placeholders
        words.each_with_index{|w,i| routes_array.gsub!(w, "$#{i}") }

        #Export words to JS
        file << "  var s = [" + words.map{|w| "'#{w}'" }.join(',') + "];\n"
        file << '  '+routes_array
        #Put the words back in (using JS) and eval the result
        file << "  r = eval('('+r.replace(/\\$(\\d+)/g, function(m,i){ return s[i]; })+')');\n\n"
        
        #Add routes
        file << "  for (var i = 0; i < r.length; i++) {\n"
        file << "    var s=[];\n"
        file << "    var segs=r[i].s.split('@');\n"
        file << "    for (var j = 0; j < segs.length; j++) {\n"
        file << "      s.push(Route.S(segs[j].slice(0, -1), segs[j].slice(-1) == 't'));\n"
        file << "    }\n"
        file << "    Routes.push(new Route(s, r[i].r, r[i].n));\n"
        file << "  }\n\n"
        file << "  Routes.extractNamed();\n\n"
        
        file << "})();"
      end

      #Add ajax extras
      File.open filename_ajax, 'w' do |f|
        f.write(File.read(JS_AJAX))
      end
      
    end
  
  rescue => e
  
    warn("\n\nCould not write routes.js: \"#{e.class}:#{e.message}\"\n\n")
    File.truncate(filename, 0) rescue nil
  
  end

end
