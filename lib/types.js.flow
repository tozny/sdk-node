/**
 * Type definitions for Flow type checking. Users of the SDK can import these
 * type definitions like this:
 *
 *     import type { Realm, User } from 'tozny-auth/lib/types'
 *
 * @flow
 */

export type Realm = {
  realm_id:        string,
  logo_url:        string,
  info_url:        string,
  display_name:    string,
  open_enrollment: boolean,
  backup:          any,
  extra_factor:    any,
}

export type User = {
  user_id:             string,
  blocked:             ?boolean,
  login_attempts:      ?number,
  tmp_block_timestamp: ?string,
  tmp_block_attempts:  ?number,
  status:              string,  // formatted as a number
  created:             string,
  modified:            string,
  last_login:          ?string,
  total_logins:        string,  // formatted as a number
  total_failed_logins: string,  // formatted as a number
  last_failed_login:   ?string,
  total_devices:       string,  // formatted as a number
  meta:                { username: string, email: string },
  tozny_primary:       string,
  tozny_secondary:     string,  // possibly empty string
  tozny_username:      string,
  tozny_email:         string,
}
