var express     = require('express')
  , session     = require('express-session')
  , Realm       = require('tozny-sdk/src/realm')
  , bodyParser  = require('body-parser')
;

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
app.use(bodyParser.urlencoded({ extended: false }));

var realm = new Realm(
  process.env.npm_package_config_realm_key_id,
  process.env.npm_package_config_realm_secret,
  process.env.npm_package_config_api_url
);

app.get('/', function(req, res) {
  if (req.session.authenticated) {
    res.redirect('/secret');
  }
  else {
    res.render('index', { realm: realm });
  }
});

app.get('/secret', function(req, res) {
  if (req.session.authenticated) {
    res.render('secret', {
      message: process.env.npm_package_config_message,
      user:    req.session.user
    });
  }
  else {
    res.redirect('/');
  }
});

app.post('/login', function(req, res) {
  var signedData = req.body.tozny_signed_data;
  var signature  = req.body.tozny_signature;
  realm.verifyLogin(signedData, signature).then(
    function success(login) {
      return realm.userGet(login.user_id).then(function(user) {
        req.session.authenticated = true;
        req.session.user = user;
        res.redirect('/secret');
      });
    }
  ).then(null,
    function error(err) {
      res.render('error', { message: err });
    }
  );
});

app.post('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('/');
  });
});

var server = app.listen(process.env.npm_package_config_port || 3000, function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log('secretmessage listening at http://%s:%s', host, port);
});
