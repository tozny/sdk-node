var express       = require('express')
  , session       = require('express-session')
  , flash         = require('connect-flash')
  , passport      = require('passport')
  , Realm         = require('tozny-sdk/src/realm')
  , ToznyStrategy = require('tozny-sdk/src/passport')
;

var realm = new Realm(
  process.env.npm_package_config_realm_key_id,
  process.env.npm_package_config_realm_secret,
  process.env.npm_package_config_api_url
);

passport.use(new ToznyStrategy(realm, { lookupUser: findOrRegister }));

var users = {};

function findOrRegister(login) {
  var user = users[login.user_id];
  if (user) {
    return user;
  }
  else {
    return realm.userGet(login.user_id).then(function(user) {
      users[user.user_id] = user;
      return user;
    });
  }
}

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

var app = express();
app.set('views', './views');
app.set('view engine', 'jade');
app.use(session({
  secret: 'app secret',
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production'
  },
  resave: true,
  saveUninitialized: false
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.get('/', function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect('/secret');
  }
  else {
    res.render('index', { realm: realm, messages: req.flash('error') });
  }
});

app.get('/secret', ensureAuthenticated, function(req, res) {
  res.render('secret', {
    message: process.env.npm_package_config_message,
    user:    req.user
  });
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  else {
    res.redirect('/');
  }
}

app.post('/login',
  passport.authenticate('tozny', {
    successRedirect: '/secret',
    failureRedirect: '/',
    failureFlash: true
  }));

app.post('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

var server = app.listen(process.env.npm_package_config_port || 3000, function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log('secretmessage listening at http://%s:%s', host, port);
});
