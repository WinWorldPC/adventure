var express = require("express"),
    fs = require("fs"),
    path = require("path"),
    passport = require("passport"),
    localStrategy = require("passport-local").Strategy,
    svgCaptcha = require("svg-captcha"),
    constants = require("./constants.js"),
    middleware = require("./middleware.js"),
    formatting = require("./formatting.js");

var config, database, sitePages;

var restrictedRoute = middleware.restrictedRoute;
var urlencodedParser = middleware.bodyParser;
var server = express.Router();

server.get("/sa/enterUser", restrictedRoute("sa"), function (req, res) {
    res.render("saEnterUser", {});
});

server.post("/sa/redirectToUserEdit", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    database.userByName(req.body.name, function (err, user) {
        if (err) {
            return res.status(500).render("error", {
                message: "There was an error fetching from the database."
            });
        } else if (user == null) {
            return res.status(404).render("error", {
                message: "There was no user."
            });
        } else {
            return res.redirect("/sa/user/" + formatting.binToHex(user.UserID));
        }
    });
});

server.get("/sa/user/:userId", restrictedRoute("sa"), function (req, res) {
    database.userById(formatting.hexToBin(req.params.userId), function (err, user) {
        if (err) {
            return res.status(500).render("error", {
                message: "There was an error fetching from the database."
            });
        } else if (user == null) {
            return res.status(404).render("error", {
                message: "There was no user."
            });
        } else {
            user.UserID = formatting.binToHex(user.UserID);
            res.render("saUser", {
                editingUser: user,
                userFlags: database.userFlags,
            });
        }
    });
});

server.post("/sa/user/changepw/:userId", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.body && req.body.newPassword && req.body.newPasswordR) {
        var uuidAsBuf = formatting.hexToBin(req.params.userId);
        if (req.body.newPassword == req.body.newPasswordR) {
            var salt = formatting.createSalt();
            var newPassword = formatting.sha256(req.body.newPassword + salt);
            // HACK: nasty way to demangle UInt8Array
            var id = formatting.hexToBin(req.user.UserID.toString("hex"));
            database.execute("UPDATE Users SET Password = ?, Salt = ? WHERE UserID = ?", [newPassword, salt, uuidAsBuf], function (pwErr, pwRes, pwFields) {
                if (pwErr) {
                    return res.status(500).render("error", {
                        message: "There was an error changing the user's password."
                    });
                } else {
                    return res.redirect("/sa/user/" + req.params.userId);
                }
            });
        } else {
            return res.status(400).render("error", {
                message: "The new passwords don't match."
            });
        }
    } else {
        return res.status(400).render("error", {
            message: "The request was malformed."
        });
    }
});

server.post("/sa/user/edit/:userId", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    // TODO: Extend as we extend editable profile options (none for now)
    if (req.body && req.body.email) {
        var uuidAsBuf = formatting.hexToBin(req.params.userId);
        // HACK: nasty way to demangle UInt8Array
        var id = formatting.hexToBin(req.user.UserID.toString("hex"));
        database.execute("UPDATE Users SET Email = ? WHERE UserID = ?", [req.body.email, uuidAsBuf], function (pwErr, pwRes, pwFields) {
            if (pwErr) {
                return res.status(500).render("error", {
                    message: "There was an error changing the user's profile."
                });
            } else {
                return res.redirect("/sa/user/" + req.params.userId);
            }
        });
    } else {
        return res.status(400).render("error", {
            message: "The request was malformed."
        });
    }
});

server.post("/sa/user/addFlag/:userId", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.body && req.body.flag) {
        var uuidAsBuf = formatting.hexToBin(req.params.userId)
        var flag = database.userFlags.filter(function (x) { return x.FlagName == req.body.flag })[0].FlagUUID;
        database.execute("INSERT INTO UserFlagHolders (FlagUUID, UserUUID) VALUES (?, ?)", [flag, uuidAsBuf], function (flErr, flRes, flFields) {
            if (flErr) {
                return res.status(500).render("error", {
                    message: "There was an error adding the flag."
                });
            } else {
                return res.redirect("/sa/user/" + req.params.userId);
            }
        });
    } else {
        return res.status(400).render("error", {
            message: "The request was malformed."
        });
    }
});

server.get("/sa/user/removeFlag/:userId/:flagName", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.params.flagName) {
        var uuidAsBuf = formatting.hexToBin(req.params.userId)
        var flag = database.userFlags.filter(function (x) { return x.FlagName == req.params.flagName })[0].FlagUUID;
        database.execute("DELETE FROM UserFlagHolders WHERE FlagUUID = ? && UserUUID = ?", [flag, uuidAsBuf], function (flErr, flRes, flFields) {
            if (flErr) {
                return res.status(500).render("error", {
                    message: "There was an error removing the flag."
                });
            } else {
                return res.redirect("/sa/user/" + req.params.userId);
            }
        });
    } else {
        return res.status(400).render("error", {
            message: "The request was malformed."
        });
    }
});

module.exports = function (c, d, p) {
    config = c
    database = d;
    sitePages = p;

    // init user flags once we're connected
    database.execute("SELECT * FROM `UserFlags`", [], function (ufErr, ufRes, ufFields) {
        // first, init userFlags
        database.userFlags = ufRes;
    });

    return server;
}