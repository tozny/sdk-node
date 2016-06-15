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
      method: method
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
    return this.rawCall('user.login_challenge', { realm_key_id: this.realmKeyId });
  }

  /**
   * Fetches realm metadata
   *
   * @return {Promise.<Object>}
   */
  realmGet(): Promise<Realm> {
    return this.rawCall('user.realm_get', { realm_key_id: this.realmKeyId })
  }
}
