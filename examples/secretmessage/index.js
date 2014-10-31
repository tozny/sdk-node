var express     = require('express')
  , Realm       = require('tozny-sdk/src/realm')
  , User        = require('tozny-sdk/src/user')
  , bodyParser  = require('body-parser')
  , cookie      = require('cookie')
;

var app = express();
app.set('views', './views');
app.set('view engine', 'jade');
app.use(bodyParser.urlencoded({ extended: false }));

var realm = new Realm(
  process.env.npm_package_config_realm_key_id,
  process.env.npm_package_config_realm_secret,
  process.env.npm_package_config_api_url
);
var user = new User(realm.keyId, realm.apiUrl);

var authenticated = {};

app.get('/', function(req, res) {
  var sessionId = getcookie(req, 'sid');
  if (authenticated[sessionId]) {
    res.redirect('/secret');
  }
  else {
    user.loginChallenge().then(function(resp) {
      res.render('index', {
        realm:      realm,
        session_id: resp.session_id,
        qr_url:     resp.qr_url,
        mobile_url: resp.mobile_url
      });
    });
  }
});

app.get('/secret', function(req, res) {
  var sessionId = getcookie(req, 'sid');
  if (authenticated[sessionId]) {
    res.render('secret', { message: process.env.npm_package_config_message });
  }
  else {
    res.redirect('/');
  }
});

app.post('/login', function(req, res) {
  var signedData = req.body.tozny_signed_data;
  var signature  = req.body.tozny_signature;
  realm.verifyLogin(signedData, signature).then(
    function success(resp) {
      authenticated[resp.session_id] = true;
      setcookie(res, 'sid', resp.session_id);
      res.redirect('/secret');
    },
    function error(err) {
      res.render('error', { message: err });
    }
  );
});

app.post('/logout', function(req, res) {
  var sessionId = getcookie(req, 'sid');
  delete authenticated[sessionId];
  res.redirect('/');
});

function getcookie(req, name) {
  var header = req.headers.cookie;
  if (header) {
    var cookies = cookie.parse(header);
    return cookies[name];
  }
}

function setcookie(res, name, val) {
  var data = cookie.serialize(name, val, {
    path:     '/',
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production'
  });
  var prev = res.get('set-cookie') || [];
  var header = Array.isArray(prev) ? prev.concat(data)
                                   : Array.isArray(data) ? [prev].concat(data)
                                                         : [prev, data];
  res.set('set-cookie', header);
}

var server = app.listen(process.env.npm_package_config_port || 3000, function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log('secretmessage listening at http://%s:%s', host, port);
});
