/*global describe, it, expect */

var Realm = require('../realm.js');

describe('realm', function() {

  if (process.env.REALM_KEY_ID &&
      process.env.SECRET &&
      process.env.API_URL &&
      process.env.USER_ID) {

    var realm = new Realm( process.env.REALM_KEY_ID
                         , process.env.SECRET
                         , process.env.API_URL );

    it('fetches user info', function(done) {
      realm.userGet(process.env.USER_ID).then(function(user) {
        expect(user.user_id).toEqual(process.env.USER_ID);
        done();
      });
    });

    it('confirms that user exists', function(done) {
      realm.userExists(process.env.USER_ID).then(function(exists) {
        expect(exists).toBeTruthy();
        done();
      });
    });

    it('reports that user does not exist', function(done) {
      realm.userExists(process.env.USER_ID + '33').then(function(exists) {
        expect(exists).toBeFalsy();
        done();
      });
    });

  }

});
