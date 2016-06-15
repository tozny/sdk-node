/*global describe, it, expect */

var tozny = require('../lib/crypto');

var REALM_KEY_ID = 'sid_d915e7226947b';
var SECRET = '8f8c9b8df39f8c8be4a39378bece4ac01cba948f9b4ef7b90acad3f49d5358f2';
var NONCE = '6b49eac58dd5e8d9aab6a5eab919fc47863cb233cc560c9b60772685e321ff50';
var EXPIRE = '1414541972';
var DATA = '{"nonce":"6b49eac58dd5e8d9aab6a5eab919fc47863cb233cc560c9b60772685e321ff50", "expires_at":"1414541972", "realm_key_id":"sid_d915e7226947b", "user_id":"sid_1234", "method":"realm.user_get"}';
var ENCODED = 'eyJub25jZSI6IjZiNDllYWM1OGRkNWU4ZDlhYWI2YTVlYWI5MTlmYzQ3ODYzY2IyMzNjYzU2MGM5YjYwNzcyNjg1ZTMyMWZmNTAiLCAiZXhwaXJlc19hdCI6IjE0MTQ1NDE5NzIiLCAicmVhbG1fa2V5X2lkIjoic2lkX2Q5MTVlNzIyNjk0N2IiLCAidXNlcl9pZCI6InNpZF8xMjM0IiwgIm1ldGhvZCI6InJlYWxtLnVzZXJfZ2V0In0';
var SIGNATURE = 'HB8PQnwlqsB6JlU9NFoDAS_NwUzEtY7EYcgVyZfjsH4';

describe('crypto', function() {

  it('encodes base64', function() {
    var encoded = tozny.toBase64(DATA);
    expect(encoded).toEqual(ENCODED);
  });

  it('decodes base64', function() {
    var decoded = tozny.fromBase64(ENCODED);
    var str = decoded.toString('utf8');
    expect(str).toEqual(DATA);
  });

  it('preserves information translating base64->text->base64', function() {
    var reencoded = tozny.toBase64(tozny.fromBase64(SIGNATURE));
    expect(reencoded).toEqual(SIGNATURE);
  });

  it('preserves information translating text->base64->text', function() {
    var redecoded = tozny.fromBase64(tozny.toBase64(DATA)).toString('utf8');
    expect(redecoded).toEqual(DATA);
  });

  it('signs messages', function(done) {
    var encoded = tozny.toBase64(DATA);
    tozny.sign(SECRET, encoded).then(function(signature) {
      expect(signature).toEqual(SIGNATURE);
      done();
    });
  });

  it('verifies signatures', function(done) {
    tozny.checkSignature(SECRET, SIGNATURE, ENCODED).then(function(legit) {
      expect(legit).toBeTruthy();
      done();
    });
  });

  it('rejects invalid signatures', function(done) {
    var secret = SECRET.split('').reverse().join('');
    tozny.checkSignature(secret, SIGNATURE, ENCODED).then(function(legit) {
      expect(legit).toBeFalsy();
      done();
    });
  });

});

describe('requests', function() {

  it('formats expiration time as a number', function(done) {
    var secret = new Buffer(SECRET, 'hex');
    tozny.mkRequest(REALM_KEY_ID, secret, 'realm.user_get', { user_id: 'sid_1234' })
    .then(function(r) {
      var decoded = tozny.fromBase64(r.signed_data).toString('utf8');
      var req = JSON.parse(decoded);
      expect(typeof req.expires_at).toEqual('string');
      expect(req.expires_at).toMatch(/^\d{10}$/);
      done();
    });
  });

});
