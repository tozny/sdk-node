var express  = require('express')
  , session  = require('express-session')
  , flash    = require('connect-flash')
  , passport = require('passport')
  , tozny    = require('tozny')
;

if (!process.env.REALM_KEY_ID || !process.env.REALM_SECRET) {
  console.log('Please set environment variables REALM_KEY_ID and REALM_SECRET.');
  process.exit(1);
}

/**
 * The `realm` object captures API credentials, and keeps the given secret
 * hidden in a closure.  `realm` implements methods for making API calls to
 * Tozny.
 */
var realm = new tozny.Realm(
  process.env.REALM_KEY_ID,
  process.env.REALM_SECRET,
  process.env.API_URL || "https://api.tozny.com"
);

/**
 * Instantiates an authentication strategy for Tozny, using the API credentials
 * encapsulated in `realm`.  The `passport.use` method registers the new
 * strategy with passport.  This strategy will be available for use later under
 * the name "tozny" when authenticating login requests.
 */
passport.use(new tozny.Strategy(realm, { lookupUser: findOrRegister }));

/**
 * Most web apps keep user records in a database.  For purposes of
 * demonstration, this app uses a simple in-memory store.
 */
var users = {};

/**
 * When a user logs in with Tozny, we get an object with login data, including
 * a `user_id` property.  This function uses the Tozny-provided user id to look
 * up the corresponding user in the app's own store of user records.
 */
function findOrRegister(login) {
  var user = users[login.user_id];
  if (user) {
    return user;
  }
  else {
    /**
     * In case there is no record matching the authenticated user,
     * makes an API call to Tozny to get information for the user.
     * That data is inserted into the local store to register the new user.
     *
     * This return value is a promise, which represents an asynchronous result.
     */
    return realm.userGet(login.user_id).then(function(user) {
      users[user.user_id] = user;
      return user;
    });
  }
}

/**
 * Passport sets a cookie with a session id, and automatically handles looking
 * up the appropriate user record when requests come in.  But to do so, passport
 * has to know how to map user records to ids, and vice-versa.  These calls
 * register callbacks to provide that information.
 *
 * According to the Node convention, the `done` callback is called on either
 * success or error.  If the first argument given to `done` is `null`, then the
 * remaining arguments are interpreted as success values.  Otherwise the first
 * argument is interpreted as an error result.
 */
passport.serializeUser(function(user, done) {
  done(null, user.user_id);
});
passport.deserializeUser(function(id, done) {
  var user = users[id];
  if (user) {
    done(null, user);
  }
  else {
    done('user not found');
  }
});

/**
 * Instantiates and configures an Express app.  The app incorporates
 * *middleware* componontes, which are composable functions that each provide
 * specific functionality.  Each invocation of `app.use` registers a middleware
 * component.
 */
var app = express();

/**
 * Instructs Express to use jade for rendering views, and to look for view
 * templates in the `/views` directory.
 */
app.set('views', './views');
app.set('view engine', 'jade');

/**
 * The [session][] middleware automatically sets a session id in cookie when a user
 * visits the app.  It also provides a data store, and maps session ids to data
 * in that store.
 *
 * [session]: https://github.com/expressjs/session
 *
 * Passport and flash both require session to operate.
 */
app.use(session({
  secret: 'app secret',
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production'
  },
  resave: true,
  saveUninitialized: false
}));

/**
 * Allows setting a message that can be read the next time the user access an
 * app endpoint.  This is useful for showing an error message after a redirect.
 */
app.use(flash());

/**
 * Initializes passport, and plugs it into the app.  This also turns on
 * passport's session integration, so that users do not have to re-authenticate
 * on every request.
 */
app.use(passport.initialize());
app.use(passport.session());

/**
 * Provides a function to handle a visit to the app's root route.  This is
 * called a *route handler*.  In this case, the handler only responds to GET
 * requests.
 */
app.get('/', function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect('/secret');  // redirects the user's browser
  }
  else {
    /**
     * Renders a view from the template in `views/index.jade`.  That view
     * includes Javascript code that fetches a login challenge and displays
     * a Tozny authentication prompt.
     */
    res.render('index', { realm: realm, messages: req.flash('error') });
  }
});

/**
 * This is a route that only authenticated users should be able to see.  The
 * `ensureAuthenticated` parameter is a filter that redirects unauthenticated
 * visitors away from this route.
 */
app.get('/secret', ensureAuthenticated, function(req, res) {
  res.render('secret', {
    message: process.env.SECRET_MESSAGE || "You are authenticated - welcome to Tozny!",

    /**
     * Passport automatically puts this `user` property on request objects if
     * the request comes with a session id that matches an authenticated
     * session.
     */
    user:    req.user
  });
});

/**
 * This filter is actually a tiny middleware component.  It works like a route
 * handler - except that in addition to request and response arguments, this
 * function uses a `next` argument.  The filtered route handler will only run if
 * `next` is called.
 */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  else {
    res.redirect('/');
  }
}

/**
 * This route handler responds to POST requests.  The view rendered for '/'
 * includes a form whose action is set to '/login'.  So when a user uses the
 * Tozny app to log in, the browser makes a POST request to this route.  The
 * request includes a challenge that the tozny library can verify.
 *
 * At this point we let passport do all the work.  Passport delegates to the
 * Tozny authentication strategy that was instantiated earlier to authenticate
 * the request.
 */
app.post('/login',
  passport.authenticate('tozny', {
    successRedirect: '/secret',
    failureRedirect: '/',
    failureFlash: true
  }));

/**
 * Passport permits combining multiple authentication strategies in a single
 * route handler. To make a login handler that works with either Tozny or with,
 * e.g. local username and password authentication, just list multiple strategy
 * names:
 *
 *     app.post('/login',
 *       passport.authenticate(['tozny', 'local'], {
 *         successRedirect: '/secret',
 *         failureRedirect: '/',
 *         failureFlash: true
 *       }));
 *
 * Though that does require configuring a "local" strategy.
 */

/**
 * This is another route that only responds to POST requests.  The `logout`
 * method is added to request objects by passport.
 */
app.post('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

/**
 * This is the point where the web app actually starts accepting network
 * requsts.
 */
var server = app.listen(process.env.PORT || 3000, function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log('secretmessage listening at http://%s:%s', host, port);
});
