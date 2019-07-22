var async = require('async');
var auth = exports;

auth.authenticate_shadow = function(user, plaintext, callback) {
  var hash = require('sha512crypt-node');
  var fs = require('fs-extra');

  function etc_shadow(inner_callback) {
    // return true if error, false if auth failed, string for user if successful
    var passwd = require('etc-passwd');

    fs.stat('/etc/shadow', function(err, stat_info) {
      if (err)
        inner_callback(true);
      else {
        passwd.getShadow({username: user}, function(err, shadow_info) {
          if (shadow_info && shadow_info.password == '!')
            inner_callback(false);
          else if (shadow_info) {
            var password_parts = shadow_info['password'].split(/\$/);
            var salt = password_parts[2];
            var new_hash = hash.sha512crypt(plaintext, salt);

            var passed = (new_hash == shadow_info['password'] ? user : false);
            inner_callback(passed);
          } else {
            inner_callback(true);
          }
        })
      }
    })
  }

  function posix(inner_callback) {
    // return true if error, false if auth failed, string for user if successful
    try {
      var crypt = require('apache-crypt');
      var posix = require('posix');
    } catch (e) {
      inner_callback(true);
      return;
    }

    try {
      var user_data = posix.getpwnam(user);
      if (crypt(plaintext, user_data.passwd) == user_data.passwd)
        inner_callback(user);
      else if (user_data) {
        // the crypt hash method fails on FreeNAS so try the sha512
        var password_parts = user_data.passwd.split(/\$/);
        var salt = password_parts[2];
        var new_hash = hash.sha512crypt(plaintext, salt);

        var passed = (new_hash == user_data.passwd ? user : false);
        inner_callback(passed);
	  } else 
        inner_callback(false);
    } catch (e) {
      inner_callback(true);
    }
  }

  function pam(inner_callback) {
    // return true if error, false if auth failed, string for user if successful
    try {
      var pam = require('authenticate-pam');
    } catch (e) {
      inner_callback(true);
      return;
    }

    pam.authenticate(user, plaintext, function(err) {
      if (err)
        inner_callback(false);
      else
        inner_callback(user);
    })
  }

  pam(function(pam_passed) {
    //due to the stack of different auths, a false if auth failed is largely ignored
    if (typeof pam_passed == 'string')
      callback(pam_passed);
    else
      etc_shadow(function(etc_passed) {
        if (typeof etc_passed == 'string')
          callback(etc_passed)
        else
          posix(function(posix_passed) {
            if (typeof posix_passed == 'string')
              callback(posix_passed)
            else
              callback(false);
          })
      })
  })
}

auth.test_membership = function(username, group, callback) {
  var getent = require('@opendrives/getent');
  var userid = require('userid');

  var membership_valid = false;
  var gg = getent.group();
  gg.forEach((group_data) => {
      if (group == group_data.name)
      try {
        if (userid.gids(username).includes(group_data.gid))
          membership_valid = true;
      } catch (e) {}
  })
  callback(membership_valid);
      
}

auth.verify_ids = function(uid, gid, callback) {
  var getent = require('@opendrives/getent');

  var uid_present = false;
  var gid_present = false;

  async.series([
    function(cb) {
      var gu = getent.passwd()
        gu.forEach((user_data) => {
          if (user_data.uid == uid)
            uid_present = true;
        })
        if (!uid_present)
          cb('UID ' + uid + ' does not exist on this system');
        else
          cb();
    },
    function(cb) {
      var gg = getent.group();
        gg.forEach((group_data) => {
          if (group_data.gid == gid)
            gid_present = true;
        })
        if (!gid_present)
          cb('GID ' + gid + ' does not exist on this system');
        else
          cb();
    }
  ], callback)
}
