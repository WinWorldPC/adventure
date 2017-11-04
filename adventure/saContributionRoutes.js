var express = require("express"),
    fs = require("fs"),
    path = require("path"),
    middleware = require("./middleware.js"),
    formatting = require("./formatting.js");

var config, database;

var restrictedRoute = middleware.restrictedRoute;
var urlencodedParser = middleware.bodyParser;
var server = express.Router();

server.get("/sa/contributions", restrictedRoute("sa"), function (req, res) {
    var page = req.query.page || 1;
    var status = req.query.status || "New";
    database.execute("SELECT COUNT(*) FROM `Contributions` WHERE `Status` = ?", [status] ,function (cErr, cRes, cFields) {
        var count = cRes[0]["COUNT(*)"];
        var pages = Math.ceil(count / config.perPage);
        database.execute("SELECT * FROM `Contributions` WHERE `Status` = ? ORDER BY ContributionCreated DESC LIMIT ?,?", [status, (page - 1) * config.perPage, config.perPage], function (coErr, coRes, coFields) {
            var contributions = coRes.map(function (x) {
                x.UserUUID = formatting.binToHex(x.ContributionUUID);
                x.ContributionUUID = formatting.binToHex(x.ContributionUUID);
                return x;
            });
            return res.render("saContributions", {
                contributions: contributions,
                status: status,
                page: page,
                pages: pages
            });
        });
    });
});

module.exports = function (c, d) {
    config = c
    database = d;

    return server;
}