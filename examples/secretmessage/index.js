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

var realm = new tozny.Realm(
  process.env.REALM_KEY_ID,
  process.env.REALM_SECRET,
  process.env.API_URL || "https://api.tozny.com"
);

passport.use(new tozny.Strategy(realm, { lookupUser: findOrRegister }));

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
    message: process.env.SECRET_MESSAGE || "You are authenticated - welcome to Tozny!",
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

var server = app.listen(process.env.PORT || 3000, function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log('secretmessage listening at http://%s:%s', host, port);
});
