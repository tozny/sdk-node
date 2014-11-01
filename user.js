var nodefn  = require('when/node')
  , request = require('request')
  , _       = require('lodash')
;

/**
 * @class user
 * @singleton
 *
 * Module that exports {@link User}.  Import with:
 *
 *     var Realm = require('tozny/user');
 *
 * or
 *
 *     var Realm = require('tozny').User;
 *
 */

/**
 * @property {User} exports
 */
module.exports = User;

/**
 * @class User
 * Provides methods for making API calls to Tozny on behalf of a user.
 *
 * @constructor
 * @param {string} realmKeyId
 * @param {string} [inApiUrl=process.env.API_URL] URL of Tozny service
 */
function User(realmKeyId, inApiUrl) {
  if (!(this instanceof User)) {
    return new User(realmKeyId, inApiUrl);
  }

  var apiUrl  = inApiUrl || process.env.API_URL;
  var post = nodefn.lift(request.post);

  /**
   * Used to make custom API calls.
   *
   * @param {string} method Name of method to invoke via RPC.
   * @param {Object} [params] Parameters to send.
   * @return {Promise.<Object>} Result depends on the API call that is made
   */
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


  /**
   * Produces a login challenge, which can be transmitted to a Tozny-enabled
   * application to complete authentication.
   *
   * @return {Promise.<{ signed_data: string, signature: string }>}
   */
  function loginChallenge() {
    return rawCall('user.login_challenge', { realm_key_id: realmKeyId });
  }

  _.assign(this, {
    loginChallenge:    loginChallenge,
    rawCall:           rawCall
  });

  Object.freeze(this);
}
