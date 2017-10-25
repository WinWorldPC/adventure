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
            return res.render("error", {
                message: "There was an error fetching from the database.."
            });
        } else if (user == null) {
            return res.render("error", {
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
            return res.render("error", {
                message: "There was an error fetching from the database.."
            });
        } else if (user == null) {
            return res.render("error", {
                message: "There was no user."
            });
        } else {
            res.render("saUser", {
                editingUser: user
            });
        }
    });
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