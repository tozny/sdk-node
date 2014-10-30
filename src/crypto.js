/*jshint boss:true */

var crypto  = require('crypto')
  , https   = require('https')
  , nodefn  = require('when/node')
  , request = require('request')
  , when    = require('when')
  , _       = require('lodash')
;

exports.sign           = sign;
exports.checkSignature = checkSignature;
exports.fromBase64     = fromBase64;
exports.toBase64       = toBase64;
exports.mkRequest      = mkRequest;
exports.sendRequest    = sendRequest;

var post = nodefn.lift(request.post);

function sendRequest(apiUrl, realmKeyId, secret, method, params) {
  return mkRequest(realmKeyId, secret, method, params).then(function(req) {
    return post({ url: apiUrl, form: req });
  }).then(function(resp) {
    return JSON.parse(resp[1]);
  });
}

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

function sign(secret, message) {
  var hmac = crypto.createHmac('sha256', secret);
  hmac.end(message);
  return consume(hmac).then(function(signature) {
    return toBase64(signature);
  });
}

function checkSignature(secret, signature, message) {
  return sign(secret, message).then(function(expected) {
    return signature == expected;
  });
}

function getNonce() {
  return nodefn.lift(crypto.randomBytes)(32).then(function(buf) {
    return buf.toString('hex');
  });
}

function getExpires() {
  var fiveMinutes = +new Date() + (5 * 60 * 1000);
  var inSeconds = Math.floor(fiveMinutes / 1000);
  return String(inSeconds);
}

function toBase64(data) {
  var buf = data instanceof Buffer ? data : new Buffer(data, 'utf8');
  return buf.toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '');
}

function fromBase64(data) {
  var fromUrlSafe = data
  .replace(/-/g, '+')
  .replace(/_/g, '/') + '=';
  return new Buffer(fromUrlSafe, 'base64');
}

function consume(stream) {
  return when.promise(function(resolve) {
    var chunks = [];
    stream.on('readable', function() {
      var chunk;
      while (chunk = stream.read()) {
        chunks.push(chunk);
      }
    });
    stream.on('end', function() {
      var output = Buffer.concat(chunks);
      resolve(output);
    });
  });
}
