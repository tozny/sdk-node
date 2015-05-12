var tozny = require('./crypto')
  , when  = require('when')
  , _     = require('lodash')
;

/**
 * @class realm
 * @singleton
 *
 * Module that exports {@link Realm}.  Import with:
 *
 *     var Realm = require('tozny-auth/lib/realm');
 *
 * or
 *
 *     var Realm = require('tozny-auth').Realm;
 *
 */

/**
 * @property {Realm} exports
 */
module.exports = Realm;

/**
 * @class Realm
 * Captures credentials for making API calls to a Tozny realm.  Provides methods
 * that implement those calls.
 *
 * All of the methods of this class return promises.  A promise is an
 * abstraction for an asynchronous result.  A promise either succeeds and
 * produces value, or fails with an error.   Every promise implements a `.then()`
 * method that can be used to register callbacks that run when the promise
 * succeeds or fails.  For example:
 *
 *     realm.userGet('sid_2ae8001385271').then(
 *       function success(user) {
 *         console.log('got user record', user);
 *       },
 *       function error(e) {
 *         console.error('an error occurred; the callback argument provides details', e);
 *       }
 *     );
 *
 * What makes promises particularly useful is that they can be chained:
 *
 *     var userPromise = realm.verifyLogin(signedData, signature).then(
 *       function success(login) {
 *         // The success callback runs another asynchronous function, and returns
 *         // another promise.
 *         return realm.userGet(login.user_id);
 *       }
 *     );
 *
 *     var userDisplayNamePromise = userPromise.then(
 *       function success(user) {
 *         // This time the success callback returns a plain value.
 *         return user.meta.displayname;
 *       }
 *     );
 *
 *     userDisplayNamePromise.then(
 *       function success(displayName) {
 *         console.log(displayName + ' has successfully logged in.');
 *       },
 *       function error(e) {
 *         // If an error occurred in the `verifyLogin` or `userGet` calls, it will be
 *         // reported here.
 *       }
 *     );
 *
 * If there is an error at any point of the chain, it will short-circuit and
 * skip the rest of the chain.  Every subsequent promise will fail, and their
 * error callbacks will receive that error explanation.  This makes promises
 * useful for avoiding a lot of explicit error-handling code.
 *
 * For more information on promises, see
 * [http://www.html5rocks.com/en/tutorials/es6/promises/](http://www.html5rocks.com/en/tutorials/es6/promises/)
 *
 * @constructor
 * @param {string} realmKeyId  This usually begins with `sid_` followed by a hexadecimal string
 * @param {string} realmSecret This is usually a long hexadecimal string
 * @param {string} [inApiUrl=process.env.API_URL] URL of Tozny service
 */
function Realm(realmKeyId, realmSecret, inApiUrl) {
  if (!(this instanceof Realm)) {
    return new Realm(realmKeyId, realmSecret, inApiUrl);
  }

  var apiUrl  = inApiUrl || process.env.API_URL;

  /**
   * Used to make custom API calls.
   *
   * @method
   * @param {string} method Name of method to invoke via RPC.
   * @param {Object} [params] Parameters to send.
   * @return {Promise.<Object>} Result depends on the API call that is made
   */
  var rawCall = _.partial(tozny.sendRequest, apiUrl, realmKeyId, realmSecret);

  /**
   * We have received a sign package and signature -
   * let's verify it.
   *
   * @param {string} signedData Who's logging in, seriaized with JSON and URL-safe base64
   * @param {string} signature The signature for the payload
   * @return {Promise.<Object>} Object with several fields:
   *
   * TODO
   *
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

  /**
   * @param {string} userId
   * @param {string} sessionId
   * @param {Date}   expiresAt
   * @return {Promise.<boolean>} True if login is valid, false otherwise
   */
  function checkValidLogin(userId, sessionId, expiresAt) {
    return rawCall('realm.check_valid_login', {
      user_id:    userId,
      session_id: sessionId,
      expires_at: tozny.encodeTime(expiresAt)
    }).then(function(resp) {
      return resp.return === 'true';
    });
  }

  /**
   * Sends a question challenge - optionally directed to a specific user.
   *
   * @param {Object} question
   * @param {string} [userId]
   * @return {Promise.<Object>} Object with several fields:
   *
   * - challenge
   * - realm_key_id
   * - session_id,
   * - qr_url
   * - mobile_url
   * - created_at
   * - presence
   */
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
   * @param {string} userId The user ID of the user we're looking for
   * @return {Promise.<boolean>} Boolean indicating whether the user exists
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
   * @param  {string} email The email of the user we're looking for
   * @return {Promise.<boolean>} Boolean indicating whether the user exists
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
   * @param {string} [defer=false] Whether to use deferred enrollment. Defaults "false".
   * @param {Array} [metadata]
   * @return {Promise.<Object>} The Tozny_API_User object if successful, otherwise false.
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
   * @param {string} userId User id to fetch
   * @return {Promise.<Object>} user_id, metadata
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

  /**
   * Update a user from the given realm
   *
   * @param {string} userId User id to update by
   * @return {Promise.<Object>} The Tozny_API_User object if successful, otherwise false.
   */
  function userUpdate(userId, extraFields) {
    var extraFieldsArg = new Buffer(JSON.stringify(extraFields)).toString('base64');

    return rawCall('realm.user_update', { user_id: userId, extra_fields: extraFieldsArg }).then(function(resp) {
      if (resp.return !== 'ok') {
        return when.reject(resp);
      }
      else {
        return resp;  // TODO: Should we pull a user object out of the response?
      }
    });
  }

  _.assign(this, {
    /**
     * @property {String}
     * @readonly
     * Realm key id that was given when this Realm object was constructed
     */
    keyId:             realmKeyId,

    /**
     * @property {String}
     * @readonly
     * API URL that was given when this Realm object was constructed.  If no URL
     * was given then this value is taken from the `API_URL` environment
     * variable.
     */
    apiUrl:            apiUrl,

    verifyLogin:       verifyLogin,
    checkSignature:    checkValidLogin,
    questionChallenge: questionChallenge,
    userExists:        userExists,
    userEmailExists:   userEmailExists,
    userAdd:           userAdd,
    userGet:           userGet,
    userUpdate:        userUpdate,
    rawCall:           rawCall
  });

  Object.freeze(this);
}