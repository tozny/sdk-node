/* @flow */

import bluebird      from 'bluebird'
import promisePlugin from 'superagent-promise-plugin'
import request       from 'superagent'
import objectAssign  from 'object-assign'

promisePlugin.Promise = bluebird

import type { Realm } from './types'

/**
 * @class user
 * @singleton
 *
 * Module that exports {@link User}.  Import with:
 *
 *     var Realm = require('tozny-auth/lib/user');
 *
 * or
 *
 *     var Realm = require('tozny-auth').User;
 *
 */

/**
 * @property {User} exports
 */

/**
 * @class User
 * Provides methods for making API calls to Tozny on behalf of a user.
 */
export default class User {
  apiUrl: string;
  realmKeyId: string;

  /**
   * @constructor
   * @param {string} realmKeyId
   * @param {string} [inApiUrl=process.env.API_URL] URL of Tozny service
   */
  constructor(realmKeyId: string, inApiUrl?: ?string) {
    const processApiUrl = typeof process !== 'undefined' && process.env
      ? process.env.API_URL
      : undefined
    this.apiUrl = inApiUrl || processApiUrl || 'https://api.tozny.com'
    this.realmKeyId = realmKeyId
  }

  /**
   * Used to make custom API calls.
   *
   * @param {string} method Name of method to invoke via RPC.
   * @param {Object} [params] Parameters to send.
   * @return {Promise.<Object>} Result depends on the API call that is made
   */
  rawCall<T>(method: string, params: Object): Promise<T> {
    var req = {
      method:       method,
      realm_key_id: this.realmKeyId
    };
    if (params) {
      objectAssign(req, params);
    }
    return request
      .post(this.apiUrl)
      .type('form')
      .send(req)
      .use(promisePlugin)
      .then(resp => resp.body)
      .then(data => (data && data.errors) ? bluebird.reject(data.errors) : data)
  }

  /**
   * Produces a login challenge, which can be transmitted to a Tozny-enabled
   * application to complete authentication.
   *
   * @return {Promise.<{ signed_data: string, signature: string }>}
   */
  loginChallenge(): Promise<{ signed_data: string, signature: string }> {
    return this.rawCall('user.login_challenge', {});
  }

  /**
   * Produces an email or SMS-based one time challenge.
   *
   * @param {string} [type]        One of "sms-otp-6," "sms-otp-8", or "email"
   * @param {string} [context]     One of “enroll,” “authenticate,” or “verify”.
   * @param {string} [destination] The phone number or email address to use.
   * @param {string} [presence]    If defined, re-use a previously used format and destination.
   * @returns {Promise.<Object>}
   */
  otpChallenge(type?: ?string, context?: ?string, destination?: ?string,
               presence?: ?string): Promise<OTPChallengeResponse> {
    const params = typeof presence !== 'undefined'
        ? {presence, context}
        : {type, destination, context}
    return this.rawCall('user.otp_challenge', params);
  }

  /**
   * Send an email or SMS-based magic link challenge to a specific destination.
   *
   * @param {string}  destination The phone number or email address to use.
   * @param {string}  endpoint    Base URL from which Tozny should generate the magic link.
   * @param {string}  [context]   One of “enroll,” “authenticate,” or “verify”.
   * @returns {Promise.<Object>}
   */
  linkChallenge(destination: string, endpoint: string, context?: ?string): Promise<OTPChallengeResponse> {
    const params = {destination, endpoint, context}
    return this.rawCall('user.link_challenge', params);
  }

  /**
   * Fetches realm metadata
   *
   * @return {Promise.<Object>}
   */
  realmGet(): Promise<Realm> {
    return this.rawCall('user.realm_get', {})
  }
}

type OTPChallengeResponse = {
  realm_key_id: string,
  session_id:   string,
  created_at:   number,
  presence:     string
}