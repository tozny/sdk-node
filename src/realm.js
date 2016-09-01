/* @flow */

import * as tozny from './crypto'
import bluebird   from 'bluebird'

import type { User } from './types'

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
 */
export default class Realm {
  /**
   * @property {String}
   * @readonly
   * Realm key id that was given when this Realm object was constructed
   */
  keyId: string;

  /**
   * @property {String}
   * @readonly
   * API URL that was given when this Realm object was constructed.  If no URL
   * was given then this value is taken from the `API_URL` environment
   * variable.
   */
  apiUrl: string;

  realmSecret: string;

  /**
   * @constructor
   * @param {string} realmKeyId  This usually begins with `sid_` followed by a hexadecimal string
   * @param {string} realmSecret This is usually a long hexadecimal string
   * @param {string} [inApiUrl=process.env.API_URL] URL of Tozny service
   */
  constructor(realmKeyId: string, realmSecret: string, inApiUrl?: ?string) {
    const processApiUrl = typeof process !== 'undefined' && process.env
      ? process.env.API_URL
      : undefined

    this.keyId       = realmKeyId
    this.realmSecret = realmSecret
    this.apiUrl      = inApiUrl || processApiUrl || 'https://api.tozny.com'
  }

  /**
   * Used to make custom API calls.
   *
   * @method
   * @param {string} method Name of method to invoke via RPC.
   * @param {Object} [params] Parameters to send.
   * @return {Promise.<Object>} Result depends on the API call that is made
   */
  rawCall(method: string, params: Object): Promise<Object> {
    return tozny.sendRequest(this.apiUrl, this.keyId, this.realmSecret, method, params);
  }

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
  verifyLogin(signedData: string, signature: string): Promise<Object> {
    return tozny.checkSignature(this.realmSecret, signature, signedData)
    .then(function(valid) {
      var decoded;
      if (valid) {
        decoded = tozny.fromBase64(signedData);
        return JSON.parse(decoded.toString('utf8'));
      }
      else {
        return bluebird.reject('invalid signature');
      }
    });
  }

  /**
   * @param {string} userId
   * @param {string} sessionId
   * @param {Date}   expiresAt
   * @return {Promise.<boolean>} True if login is valid, false otherwise
   */
  checkValidLogin(userId: string, sessionId: string, expiresAt: Date): Promise<boolean> {
    return this.rawCall('realm.check_valid_login', {
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
  questionChallenge(question: Object, user_id?: ?string
                   ): Promise<QuestionChallengeResponse> {
    const params = typeof user_id !== 'undefined'
      ? { question, user_id }
      : { question }
    return this.rawCall('realm.question_challenge', params);
  }

  /**
   * Send an email or SMS-based one time password challenge to a specific destination.
   *
   * @param {string} [type]        One of "sms-otp-6," "sms-otp-8", or "email"
   * @param {string} [context]     One of “enroll,” “authenticate,” or “verify”.
   * @param {string} [destination] The phone number or email address to use.
   * @param {string} [presence]    If defined, re-use a previously used format and destination.
   * @param {string} [data]        Serialized JSON object containing data to be added to the signed response.
   * @returns {Promise.<Object>}
   */
  otpChallenge(type?: ?string, context?: ?string, destination?: ?string, presence?: ?string,
               data?: ?string): Promise<OTPChallengeResponse> {
    const params = typeof presence !== 'undefined'
        ? {presence, data, context}
        : {type, destination, data, context}
    return this.rawCall('realm.otp_challenge', params);
  }

  /**
   * Send an email or SMS-based magic link challenge to a specific destination.
   *
   * @param {string}  destination The phone number or email address to use.
   * @param {string}  endpoint    Base URL from which Tozny should generate the magic link.
   * @param {number}  [lifespan]  Number of seconds for which the link will be valid. Default is 300 (5 minutes).
   * @param {string}  [context]   One of “enroll,” “authenticate,” or “verify”.
   * @param {boolean} [send]      Flag whether to send the message (true) or return the magic link (false).
   * @param {string}  [data]      Serialized JSON object containing data to be added to the signed response.
   * @returns {Promise.<Object>}
   */
  linkChallenge(destination: string, endpoint: string, lifespan?: ?number, context?: ?string,
                send?: ?boolean, data?: ?string): Promise<OTPChallengeResponse> {

    // Convert the Boolean value to a yes/no literal
    send = (typeof send === 'undefined' || !! send) ? 'yes' : 'no';

    const params = {destination, endpoint, lifespan, context, send, data}
    return this.rawCall('realm.link_challenge', params);
  }


  /**
   * Does the given user exist in this realm?
   *
   * @param {string} userId The user ID of the user we're looking for
   * @return {Promise.<boolean>} Boolean indicating whether the user exists
   */
  userExists(userId: string): Promise<boolean> {
    return this.rawCall('realm.user_exists', { user_id: userId }).then(function(resp) {
      if (resp.return === 'true' && typeof resp.user_id !== 'undefined') {
        return true;
      }
      else if (resp.return === 'false') {
        return false;
      }
      else {
        return bluebird.reject(resp);
      }
    });
  }


  /**
   * Does the given user exist in this realm?
   *
   * @param  {string} email The email of the user we're looking for
   * @return {Promise.<boolean>} Boolean indicating whether the user exists
   */
  userEmailExists(email: string): Promise<boolean> {
    return this.rawCall('realm.user_exists', { tozny_email: email }).then(function(resp) {
      if (resp.return === 'true' && typeof resp.user_id !== 'undefined') {
        return true;
      }
      else if (resp.return === 'false') {
        return false;
      }
      else {
        return bluebird.reject(resp);
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
  userAdd(defer: string = "false", metadata: Object[]): Promise<User|boolean> {
    const params = metadata
      ? { defer, extra_fields: tozny.toBase64(JSON.stringify(metadata)) }
      : { defer }
    return this.rawCall('realm.user_add', params).then(function(resp) {
      if (resp.return !== 'ok') {
        return bluebird.reject(resp);
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
  userGet(userId: string): Promise<User> {
    return this.rawCall('realm.user_get', { user_id: userId }).then(function(resp) {
      if (resp.results) {
        return resp.results;
      }
      else {
        return bluebird.reject(resp);
      }
    });
  }

  /**
   * Get list of users in a given realm, optionally filtered by params.
   *
   * @param {Object} params
   * @return {Promise.<Object>}
   */
  usersGet(params: UsersGetParams = {}): Promise<UsersGetResults> {
    return this.rawCall('realm.users_get', params).then(function(resp) {
      if (resp.results) {
        return resp.results;
      }
      else {
        return bluebird.reject(resp);
      }
    })
  }

  /**
   * Update a user from the given realm
   *
   * @param {string} userId User id to update by
   * @return {Promise.<Object>} The Tozny_API_User object if successful, otherwise false.
   */
  userUpdate(userId: string, extraFields: Object): Promise<Object> {
    var extraFieldsArg = new Buffer(JSON.stringify(extraFields)).toString('base64');

    return this.rawCall('realm.user_update', { user_id: userId, extra_fields: extraFieldsArg }).then(function(resp) {
      if (resp.return !== 'ok') {
        return bluebird.reject(resp);
      }
      else {
        return resp;  // TODO: Should we pull a user object out of the response?
      }
    });
  }
}

type OTPChallengeResponse = {
  realm_key_id: string,
  session_id:   string,
  created_at:   number,
  presence:     string,
  url?:         string
}

type QuestionChallengeResponse = {
  challenge:    Object,
  session_id:   string,
  realm_key_id: string,
  qr_url:       string,
  mobile_url:   string,
  created_at:   string,
  presence:     string,
}

type UsersGetParams = {
  term?:           string,
  meta_advanced?:  any,
  meta_fields?:    any,
  tozny_advanced?: any,
  tozny_fields?:   any,
  user_ids?:       any,
  rows?:           number,
  offset?:         number,
  page?:           number,
}

// Value is a map from user IDs to user values
type UsersGetResults = { [key:string]: User }
