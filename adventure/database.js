var mysql = require("mysql2"),
    formatting = require("./formatting.js");

var pool = null;

module.exports = {
    createConnection: function (params) {
        pool = mysql.createPool(params);
    },
    
    // generic DB query
    execute: function () {
        var sql_args = [];
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        var callback = args[args.length - 1]; //last arg is callback
        pool.getConnection(function (err, connection) {
            if (err) {
                console.log(err);
                return callback(err);
            }
            if (args.length > 2) {
                sql_args = args[1];
            }
            connection.execute(args[0], sql_args, function (err, results, fields) {
                connection.release(); // always put connection back in pool after last query
                if (err) {
                    console.log(err);
                    return callback(err);
                }
                callback(null, results, fields);
            });
        });
    },

    // TODO: Turn raw queries from routes into more usable functions (abstract away SQL)
    
    userFlags: [],
    populateUserFlags: function () {
        this.execute("SELECT * FROM `UserFlags`", [], function (ufErr, ufRes, ufFields) {
            // first, init userFlags
            this.userFlags = ufRes;
        });
    },
    userGetFlags: function (id, cb) {
        this.execute("SELECT DISTINCT `FlagUUID`,`UserUUID` FROM `UserFlagHolders` WHERE `UserUUID` = ?", [formatting.hexToBin(id)], function (fhErr, fhRes, fhFields) {
            var flags = fhRes.map(function (x) {
                return module.exports.userFlags.find(function (z) { return z.FlagUUID.toString("hex") == x.FlagUUID.toString("hex") });
            });
            return cb(fhErr, flags);
        });
    },
    userByName: function (username, cb) {
        this.execute("SELECT * FROM `Users` WHERE `ShortName` = ?", [username], function (uErr, uRes, uFields) {
            var user = uRes[0] || null;
            if (uErr || user == null) {
                return cb(uErr, null);
            } else {
                module.exports.userGetFlags(user.UserID.toString("hex"), function (err, flags) {
                    user.UserFlags = flags;
                    return cb(null, user);
                });
            }
        });
    },
    userByEmail: function (email, cb) {
        this.execute("SELECT * FROM `Users` WHERE `Email` = ?", [email], function (uErr, uRes, uFields) {
            var user = uRes[0] || null;
            if (uErr || user == null) {
                return cb(uErr, null);
            } else {
                module.exports.userGetFlags(user.UserID.toString("hex"), function (err, flags) {
                    user.UserFlags = flags;
                    return cb(null, user);
                });
            }
        });
    },
    userById: function (id, cb) {
        this.execute("SELECT * FROM `Users` WHERE `UserID` = ?", [id], function (uErr, uRes, uFields) {
            var user = uRes[0] || null;
            if (uErr || user == null) {
                return cb(uErr, null);
            } else {
                module.exports.userGetFlags(user.UserID.toString("hex"), function (err, flags) {
                    user.UserFlags = flags;
                    return cb(null, user);
                });
            }
        });
    },
    userUpdateLastSeenTime: function (id, cb) {
        this.execute("UPDATE Users SET LastSeenTime = NOW() WHERE UserId = ?", [id], function (lsErr, lsRes, lsFields) {
            cb(lsErr);
        });
    },
    userChangePassword: function (id, password, cb) {
        var salt = formatting.createSalt();
        var newPassword = formatting.sha256(password + salt);
        this.execute("UPDATE Users SET Password = ?, Salt = ? WHERE UserID = ?", [newPassword, salt, id], function (pwErr, pwRes, pwFields) {
            cb(pwErr);
        });
    },
    userEditProfile: function (id, enabled, email, cb) {
        this.execute("UPDATE Users SET Email = ?, AccountEnabled = ? WHERE UserID = ?", [email, enabled, id], function (prErr, prRes, prFields) {
            cb(prErr);
        });
    }
};