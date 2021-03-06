/* @flow */

import * as crypto                        from 'crypto'
import promisePlugin                      from 'superagent-promise-plugin'
import { default as bluebird, promisify } from 'bluebird'
import request                            from 'superagent'
import objectAssign                       from 'object-assign'

export {
  sign,
  checkSignature,
  encodeTime,
  fromBase64,
  toBase64,
  mkRequest,
  sendRequest,
}

promisePlugin.Promise = bluebird

/**
 * @class crypto
 * @singleton
 *
 * Module that exports functions to produce, sign, serialize, and deserialize
 * API challenges and responses.
 * Intended for internal use.
 */

/**
 * General function that produces, signs, and dispatches API requests.
 * This function powers all of the methods in {@link Realm}.
 *
 * @param {string} apiUrl
 * @param {string} realmKeyId
 * @param {string} secret
 * @param {string} method Name of API method to invoke via RPC
 * @param {Object} [params] Parameters to send with API call
 * @return {Promise.<Object>}
 */
function sendRequest<T>(apiUrl: string,
                        realmKeyId: string,
                        secret: string,
                        method: string,
                        params: Object): Promise<T> {
  return mkRequest(realmKeyId, secret, method, params).then(function(req) {
    return request
      .post(apiUrl)
      .type('form')
      .send(req)
      .use(promisePlugin)
      .then(resp => resp.body);
  });
}

/**
 * Constructs and signs an API challenge.  The result is an object that can be
 * encoded as URL parameters or form paraters, and sent over the wire.
 *
 * @param {string} realmKeyId
 * @param {string} secret
 * @param {string} method Name of API method to invoke via RPC
 * @param {Object} [params] Parameters to send with API call
 * @return {Promise.<{ signed_data: string, signature: string }>}
 */
function mkRequest(realmKeyId: string,
                   secret: string,
                   method: string,
                   params: Object): Promise<{ signed_data: string, signature: string }> {
  return getNonce().then(function(nonce) {
    var req = {
      nonce: nonce,
      expires_at: getExpires(),
      realm_key_id: realmKeyId,
      method: method
    };
    if (params) {
      objectAssign(req, params);
    }
    var encoded = toBase64(JSON.stringify(req));
    return sign(secret, encoded)
    .then(function(signature) {
      return {
        signed_data: encoded,
        signature: signature
      };
    });
  });
}

/**
 * Produces an HMAC signature of an arbitrary [Buffer][] or utf8-encoded string.
 *
 * [Buffer]: http://nodejs.org/api/buffer.html#buffer_new_buffer_str_encoding
 *
 * @param {string} secret UTF8-encoded (a.k.a. ASCII) hexadecimal string
 * @param {Buffer/string} message Message to sign
 * @return {Promise.<string>} URL-safe base64-encoded signature
 */
function sign(secret: string, message: Buffer|string): Promise<string> {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(message);
  const result = toBase64(hmac.digest());
  return bluebird.resolve(result);
}

/**
 * Verifies a signature by reproducing it, given the same secret and message.
 *
 * @param {string} secret UTF8-encoded (a.k.a. ASCII) hexadecimal string
 * @param {string} signature URL-safe base64-encoded signature to verify
 * @param {Buffer/string} message Message corresponding to signature
 * @return {Promise.<boolean>} True if computed signature matches the given signature
 */
function checkSignature(secret: string, signature: string, message: Buffer|string): Promise<boolean> {
  return sign(secret, message).then(function(expected) {
    return signature == expected;  // TODO: timing insensitive comparison
  });
}

/**
 * Computes 32 random bytes, encoded as a hexadecimal string.  Uses Node's
 * built-in [`crypto.randomBytes`][randomBytes] function, which is reported to
 * be cryptographically strong.
 *
 * [randomBytes]: http://nodejs.org/api/crypto.html#crypto_crypto_randombytes_size_callback
 *
 * @private
 */
function getNonce() {
  return promisify(crypto.randomBytes)(32).then(function(buf) {
    return buf.toString('hex');
  });
}

function getExpires() {
  var fiveMinutes = +new Date() + (5 * 60 * 1000);
  return encodeTime(fiveMinutes);
}

/**
 * Given a Date or a number of milliseconds from January 1, 1970, returns
 * a string expressing the same time as number of seconds from January 1, 1970.
 *
 * @param {Date/number} time
 * @return {string}
 */
function encodeTime(time: Date|number): string {
  var inSeconds = Math.floor(time / 1000);
  return String(inSeconds);
}

/**
 * Encodes a [Buffer][] or a utf8-encoded string using a URL-safe variant of Base64.
 *
 * [Buffer]: http://nodejs.org/api/buffer.html#buffer_new_buffer_str_encoding
 *
 * @param {Buffer/string} data
 * @return {string}
 */
function toBase64(data: Buffer|string): string {
  var buf = data instanceof Buffer ? data : new Buffer(data, 'utf8');
  return buf.toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '');
}

/**
 * Decodes a string from a URL-safe variant of Base64 into a Buffer.
 *
 * [Buffer]: http://nodejs.org/api/buffer.html#buffer_new_buffer_str_encoding
 *
 * @param {string} data
 * @return {Buffer}
 */
function fromBase64(data: string): Buffer {
  var fromUrlSafe = data
  .replace(/-/g, '+')
  .replace(/_/g, '/') + '=';
  return new Buffer(fromUrlSafe, 'base64');
}
