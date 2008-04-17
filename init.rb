require 'javascript_routes'

ActionController::Routing::Routes.load!
JavascriptRoutes.generate(:lite => ENV['ROUTES_JS_LITE'])