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
    userFlagsPopulate: function () {
        this.execute("SELECT * FROM `UserFlags`", [], function (ufErr, ufRes, ufFields) {
            // first, init userFlags
            this.userFlags = ufRes;
        });
    },
    userFlagByName: function (name) {
        return this.userFlags.filter(function (x) { return x.FlagName == name })[0].FlagUUID;
    },
    userGetFlags: function (id, cb) {
        this.execute("SELECT DISTINCT `FlagUUID`,`UserUUID` FROM `UserFlagHolders` WHERE `UserUUID` = ?", [id], function (fhErr, fhRes, fhFields) {
            var flags = fhRes.map(function (x) {
                return module.exports.userFlags.find(function (z) { return z.FlagUUID.toString("hex") == x.FlagUUID.toString("hex") });
            });
            return cb(fhErr, flags);
        });
    },
    userByName: function (username, cb) {
        this.execute("SELECT * FROM `Users` WHERE `ShortName` = ?", [username], function (uErr, uRes, uFields) {
            var user = uRes[0] || null;
            if (uErr) {
                return cb(uErr, null);
            } else if (user == null) {
                return cb(null, null);
            } else {
                module.exports.userGetFlags(user.UserID, function (err, flags) {
                    user.UserFlags = flags;
                    return cb(null, user);
                });
            }
        });
    },
    userByEmail: function (email, cb) {
        this.execute("SELECT * FROM `Users` WHERE `Email` = ?", [email], function (uErr, uRes, uFields) {
            var user = uRes[0] || null;
            if (uErr) {
                return cb(uErr, null);
            } else if (user == null) {
                return cb(null, null);
            } else {
                module.exports.userGetFlags(user.UserID, function (err, flags) {
                    user.UserFlags = flags;
                    return cb(null, user);
                });
            }
        });
    },
    userById: function (id, cb) {
        this.execute("SELECT * FROM `Users` WHERE `UserID` = ?", [id], function (uErr, uRes, uFields) {
            var user = uRes[0] || null;
            if (uErr) {
                return cb(uErr, null);
            } else if (user == null) {
                return cb(null, null);
            } else {
                module.exports.userGetFlags(user.UserID, function (err, flags) {
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
        formatting.generateHashPassword(password, function(err, hash) {
            this.execute("UPDATE Users SET Password = ? WHERE UserID = ?", [hash, id], function (pwErr, pwRes, pwFields) {
                cb(pwErr);
            });
        })
    },
    userEditProfile: function (id, enabled, email, cb) {
        this.execute("UPDATE Users SET Email = ?, AccountEnabled = ? WHERE UserID = ?", [email, enabled, id], function (prErr, prRes, prFields) {
            cb(prErr);
        });
    },
    userAddFlag: function (id, flag, cb) {
        var flag = this.userFlagByName(flag);
        this.execute("INSERT INTO UserFlagHolders (FlagUUID, UserUUID) VALUES (?, ?)", [flag, id], function (flErr, flRes, flFields) {
            cb(flErr)
        });
    },
    userRemoveFlag: function (id, flag, cb) {
        var flag = this.userFlagByName(flag);
        this.execute("DELETE FROM UserFlagHolders WHERE FlagUUID = ? && UserUUID = ?", [flag, id], function (flErr, flRes, flFields) {
            cb(flErr)
        });
    },
    userCreate: function (username, email, password, ip, cb) {
        formatting.hashPassword(password, function(err, hash) {
            this.execute("INSERT INTO `Users` (`ShortName`, `Email`, `Password`,  `RegistrationIP`) VALUES (?, ?, ?, ?, ?)", [username, email, hash, ip], function (inErr, inRes, inFields) {
                cb(inErr);
            });
        })
    },
};