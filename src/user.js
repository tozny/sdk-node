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
   * Validate a 6 or 8-digit OTP against a user session.
   *
   * @param {string} otp        OTP to validate
   * @param {string} session_id ID of the session through which the OTP was created
   * @returns {Promise.<Object>}
   */
  otpResult(otp: string, session_id: string): Promise<OTPResultResponse> {
    const params = {otp, session_id}
    return this.rawCall('user.otp_result', params);
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
   * Validate an OTP embedded in a magic link.
   *
   * @param {string} otp OTP to validate
   * @returns {Promise.<Object>}
   */
  linkResult(otp: string): Promise<OTPResultResponse> {
    const params = {otp}
    return this.rawCall('user.link_result', params);
  }

  /**
   * Exchange a signed OTP payload for an enrollment challenge.
   *
   * @param {string} signed_data Original OTP payload session
   * @param {string} signature   Realm-signed signature of the payload
   * @returns {Promise.<T>}
   */
  enrollmentChallengeExchange(signed_data: string, signature: string): Promise<EnrollmentChallengeResponse> {
    const params = {signed_data, signature}
    return this.rawCall('user.challenge_exchange', params);
  }

  /**
   * Exchange a signed OTP payload for an authentication session.
   *
   * @param {string} signed_data  Original OTP payload session
   * @param {string} signature    Realm-signed signature of the payload
   * @param {string} [session_id] If provided, this authentication session will be completed
   * @returns {Promise.<T>}
   */
  authenticationChallengeExchange(signed_data: string, signature: string,
                                  session_id?: ?string): Promise<AuthenticationChallengeResponse> {
    const params = {signed_data, signature, session_id}
    return this.rawCall('user.challenge_exchange', params);
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

type OTPResultResponse = {
  signed_data: string,
  signature:   string
}

type EnrollmentChallengeResponse = {
  user_id:                  string,
  temp_key:                 string,
  secret_enrollment_url:    string,
  secret_enrollment_qr_url: string,
  key_id:                   string,
  created:                  number,
  status:                   number
}

type AuthenticationChallengeResponse = {
  signed_data: string,
  signature:   string
}