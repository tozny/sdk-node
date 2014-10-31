var tozny = require('./crypto')
  , when  = require('when')
  , _     = require('lodash')
;

module.exports = Realm;

function Realm(realmKeyId, realmSecret, inApiUrl) {
  if (!(this instanceof Realm)) {
    return new Realm(realmKeyId, realmSecret, inApiUrl);
  }

  var apiUrl  = inApiUrl || process.env.API_URL;
  var rawCall = _.partial(tozny.sendRequest, apiUrl, realmKeyId, realmSecret);

  /**
   * We have received a sign package and signature
   * lets verify it
   *
   * @param string $signed_data - who's logging in
   * @param string $signature - the signature for the payload
   * @return mixed the decoded JSON data or FALSE
   */
  function verifyLogin(signedData, signature) {
    return tozny.checkSignature(realmSecret, signature, signedData)
    .then(function(valid) {
      var decoded;
      if (valid) {
        decoded = tozny.fromBase64(signedData);
        return JSON.parse(decoded.toString('utf8'));
      }
      else {
        return when.reject('invalid signature');
      }
    });
  }

  function checkValidLogin(userId, sessionId, expiresAt) {
    return rawCall('realm.check_valid_login', {
      user_id:    userId,
      session_id: sessionId,
      expires_at: expiresAt
    }).then(function(resp) {
      return resp.return === 'true';
    });
  }

  function questionChallenge(question, userId) {
    var params = { question: question };
    if (typeof userId !== 'undefined') {
      params.user_id = userId;
    }
    return rawCall('realm.question_challenge', params);
  }


  /**
   * Does the given user exist in this realm?
   *
   * @param int $user_id The user ID of the user we're looking for
   * @return boolean true if the user is known and there are no errors.
   */
  function userExists(userId) {
    return rawCall('realm.user_exists', { user_id: userId }).then(function(resp) {
      if (resp.return === 'true' && typeof resp.user_id !== 'undefined') {
        return true;
      }
      else if (resp.return === 'false') {
        return false;
      }
      else {
        return when.reject(resp);
      }
    });
  }


  /**
   * Does the given user exist in this realm?
   *
   * @param  string $email The email of the user we're looking for
   * @return boolean|int false if the user does not exist, or there was an .
   */
  function userEmailExists(email) {
    return rawCall('realm.user_exists', { tozny_email: email }).then(function(resp) {
      if (resp.return === 'true' && typeof resp.user_id !== 'undefined') {
        return true;
      }
      else if (resp.return === 'false') {
        return false;
      }
      else {
        return when.reject(resp);
      }
    });
  }


  /**
   * Add this user to the given realm.
   *
   * @param string $defer (optional) Whether to use deferred enrollment. Defaults "false".
   * @param array $metadata (optional)
   * @return The Tozny_API_User object if successful, otherwise false.
   */
  function userAdd(defer, metadata) {
    if (typeof defer === 'undefined') {
      defer = 'false';
    }
    var params = { defer: defer };
    if (metadata) {
      params.extra_fields = tozny.toBase64(JSON.stringify(metadata));
    }
    return rawCall('realm.user_add', params).then(function(resp) {
      if (resp.return !== 'ok') {
        return when.reject(resp);
      }
      else {
        return resp;  // TODO: Should we pull a user object out of the response?
      }
    });
  }

  /**
   * Get a user from the given realm
   *
   * @param string $user_id User id to fetch
   * @return array user_id, metadata
   */
  function userGet(userId) {
    return rawCall('realm.user_get', { user_id: userId }).then(function(resp) {
      if (resp.results) {
        return resp.results;
      }
      else {
        return when.reject(resp);
      }
    });
  }

  _.assign(this, {
    keyId:             realmKeyId,
    apiUrl:            apiUrl,
    verifyLogin:       verifyLogin,
    checkSignature:    checkValidLogin,
    questionChallenge: questionChallenge,
    userExists:        userExists,
    userEmailExists:   userEmailExists,
    userAdd:           userAdd,
    userGet:           userGet,
    rawCall:           rawCall
  });

  Object.freeze(this);
}
