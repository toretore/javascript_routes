require File.join(File.dirname(__FILE__), '..', 'lib', 'javascript_routes')
require File.join(File.dirname(__FILE__), '..', 'bin', 'jsmin')

namespace :routes do
  namespace :js do
  
    desc 'Generate routes.js based on routes defined in routes.rb'
    task :generate => :environment do
      ActionController::Routing::Routes.load!
      JavascriptRoutes.generate(:lite => ENV['lite'], :pack => ENV['pack'] != 'false')
      puts "Generated #{JavascriptRoutes::FILENAME}"
      puts "Generated #{JavascriptRoutes::FILENAME_AJAX}"
    end
    
    desc 'Minify the routes.js base file'
    task :minify => :environment do
      infile = JavascriptRoutes::JS
      outfile = JavascriptRoutes::JS_PACKED
      
      File.open(infile, 'r') do |input|
        File.open(outfile, 'w') do |output|
          JSMin.new(input, output).jsmin
        end
      end
      
      puts "#{File.size(infile)}   #{infile}"
      puts "#{File.size(outfile)}   #{outfile}"
    end
  end
end
