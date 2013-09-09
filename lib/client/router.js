/**
 * Client side router.
 *
 * @class ClientRouter
 * @exports ClientRouter
 * @extends IronRouter
 */

ClientRouter = Utils.extend(IronRouter, {
  typeName: 'ClientRouter',

  /**
   * @constructor
   * @param {Object} [options]
   * @param {Boolean} [options.autoRender] Automatically render to the body
   * @param {Boolean} [options.autoStart] Automatically start listening to
   * events
   */

  constructor: function (options) {
    var self = this;

    ClientRouter.__super__.constructor.apply(this, arguments);

    self.isRendered = false;
    self.layoutController = new LayoutController;

    Meteor.startup(function () {
      setTimeout(function () {
        if (self.options.autoRender !== false)
          self.autoRender();
        if (self.options.autoStart !== false)
          self.start();
      });
    });
  },

  setLayout: function (layout) {
    this.layoutController.setLayout(layout);
  },

  setTemplate: function (template, to) {
    this.layoutController.setTemplate(template, to);
  },

  setData: function (data) {
    this.layoutController.setData(data);
  },

  run: function (controller, cb, onUnhandled) {
    var self = this
      , isReactive = controller.isReactive !== false
      , args = _.toArray(arguments);

    var maybeRunReactively = function () {
      if (isReactive) {
        Deps.autorun(function (c) {
          self._routeComputation = c;
          ClientRouter.__super__.run.apply(self, args);
        });
      } else {
          ClientRouter.__super__.run.apply(self, args);
      }
    };

    if (self._routeComputation) {
      self._routeComputation.stop();
      self._routeComputation.onInvalidate(maybeRunReactively);
    } else {
      maybeRunReactively();
    }
  },

  /**
   * Wrapper around Location.go that accepts a routeName or a path as the first
   * parameter. This method can accept client and server side routes.
   *
   * Examples:
   *
   *  1. Router.go('/posts', {state: 'true'});
   *  2. Router.go('postIndex', [param1, param2], {state});
   *
   * @param {String} routeNameOrPath
   * @param {Array|Object} [params]
   * @param {Object} [state]
   * @param {Boolean} [replaceState]
   * @api public
   */

  go: function (routeNameOrPath, params, options) {
    var isPathRe = /^\/|http/
      , route
      , path
      , onComplete
      , controller
      , done = function() {
        options = options || {};
        IronLocation.set(path, {
          replaceState: options.replaceState,
          state: options.state,
          skipReactive: true
        });
      };

    if (isPathRe.test(routeNameOrPath)) {
      path = routeNameOrPath;
      options = params;
      // issue here is in the dispatch process we might want to
      // make a server request so therefore not call this method yet, so
      // we need to push the state only after we've decided it's a client
      // request, otherwise let the browser handle it and send off to the
      // server
      this.dispatch(path, options, done);
    } else {
      route = this.routes[routeNameOrPath];
      Utils.assert(route, 'No route found named ' + routeNameOrPath);
      path = route.path(params, options);
      controller = route.getController(path, options);
      this.run(controller, done);
    }
  },

  /**
   * Returns an html string or a document fragment with the router's layout.
   * This method also sets up the 'yield' helper on the layout. This is so that
   * the yield helper has a reference to the router through the closure.
   *
   * @returns {String|DocumentFragment}
   * @api public
   */

  render: function () {
    this.isRendered = true;
    return this.layoutController.renderLayout();
  },

  /**
   * Render the router into the body of the page automatically. Calles the
   * render method inside Spark.render to create a renderer and appends to the
   * document body.
   *
   * @api public
   */

  autoRender: function () {
    var frag = this.render();
    document.body.appendChild(frag);
  },


  /**
   * Start listening to click events and set up a Deps.autorun for location
   * changes. If already started the method just returns.
   *
   * @api public
   */

  start: function () {
    var self = this;

    if (self.isStarted) return;

    self.isStarted = true;
    
    Deps.autorun(function (c) {
      var location;
      self._locationComputation = c;
      location = IronLocation.get();
      self.dispatch(location.pathname, {state: history.state});
    });
  },

  /**
   * Remove click event listener and stop listening for location changes.
   *
   * @api public
   */

  stop: function () {
    this.isStarted = false;

    if (this._locationComputation)
      this._locationComputation.stop();
  },

  /**
   * If the route is unhandled on the client, try sending the request to the
   * server. If instead the route is not found (on client or server) the
   * IronRouter will throw an exception.
   *
   * @param {String} path
   * @param {Object} [options]
   * @api public
   */

  onUnhandled: function (path, options) {
    this.stop();
    window.location = path;
  }
});

/**
 * The main Router instance that clients will deal with
 *
 * @api public
 * @exports Router
 */

Router = new ClientRouter;