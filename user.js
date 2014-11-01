var nodefn  = require('when/node')
  , request = require('request')
  , _       = require('lodash')
;

module.exports = User;

function User(realmKeyId, inApiUrl) {
  if (!(this instanceof User)) {
    return new User(realmKeyId, inApiUrl);
  }

  var apiUrl  = inApiUrl || process.env.API_URL;
  var post = nodefn.lift(request.post);

  function rawCall(method, params) {
    var req = {
      method: method
    };
    if (params) {
      _.assign(req, params);
    }
    return post({ url: apiUrl, form: req }).then(function(resp) {
      return JSON.parse(resp[1]);
    });
  }


  function loginChallenge() {
    return rawCall('user.login_challenge', { realm_key_id: realmKeyId });
  }

  _.assign(this, {
    loginChallenge:    loginChallenge,
    rawCall:           rawCall
  });

  Object.freeze(this);
}
