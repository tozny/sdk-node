/*jshint boss:true */

var crypto        = require('crypto')
  , promisePlugin = require('superagent-promise-plugin')
  , Promise       = require('bluebird')
  , request       = require('superagent')
  , toPromise     = require('stream-to-promise')
  , _             = require('lodash')
;
var promisify = Promise.promisify;

exports.sign           = sign;
exports.checkSignature = checkSignature;
exports.encodeTime     = encodeTime;
exports.fromBase64     = fromBase64;
exports.toBase64       = toBase64;
exports.mkRequest      = mkRequest;
exports.sendRequest    = sendRequest;

promisePlugin.Promise = Promise;

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
function sendRequest(apiUrl, realmKeyId, secret, method, params) {
  return mkRequest(realmKeyId, secret, method, params).then(function(req) {
    return request.post(url).send(req).use(promisePlugin);
  }).then(function(resp) {
    return JSON.parse(resp[1]);
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
function mkRequest(realmKeyId, secret, method, params) {
  return getNonce().then(function(nonce) {
    var req = {
      nonce: nonce,
      expires_at: getExpires(),
      realm_key_id: realmKeyId,
      method: method
    };
    if (params) {
      _.assign(req, params);
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
function sign(secret, message) {
  var hmac = crypto.createHmac('sha256', secret);
  hmac.end(message);
  return toPromise(hmac).then(function(signature) {
    return toBase64(signature);
  });
}

/**
 * Verifies a signature by reproducing it, given the same secret and message.
 *
 * @param {string} secret UTF8-encoded (a.k.a. ASCII) hexadecimal string
 * @param {string} signature URL-safe base64-encoded signature to verify
 * @param {Buffer/string} message Message corresponding to signature
 * @return {Promise.<boolean>} True if computed signature matches the given signature
 */
function checkSignature(secret, signature, message) {
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
function encodeTime(time) {
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
function toBase64(data) {
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
function fromBase64(data) {
  var fromUrlSafe = data
  .replace(/-/g, '+')
  .replace(/_/g, '/') + '=';
  return new Buffer(fromUrlSafe, 'base64');
}
