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
                x.UserUUID = formatting.binToHex(x.UserUUID);
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

server.get("/sa/contribution/:contribution", restrictedRoute("sa"), function (req, res) {
    database.execute("SELECT * FROM `Contributions` WHERE `ContributionUUID` = ?", [formatting.hexToBin(req.params.contribution)], function (cErr, cRes, cFields) {
        // now get any perphiery stuff

        var contribution = cRes[0] || null;
        if (cErr || contribution == null) {
            return res.status(404).render("error", {
                message: "There is no contribution."
            });
        }

        var contributions = cRes.map(function (x) {
            x.UserUUID = formatting.binToHex(x.UserUUID);
            x.ContributionUUID = formatting.binToHex(x.ContributionUUID);
            return x;
        });

        return res.render("saContribution", {
            contribution: contribution,
            platformMappingsInverted: formatting.invertObject(config.constants.platformMappings)
        });

    });
});

server.post("/sa/rejectContribution/:contribution", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.body && req.body.rejectionReason) {
        var uuid = req.params.contribution;
        var uuidAsBuf = formatting.hexToBin(uuid);
        var status = "Rejected";
        var rejectionReason = req.body.rejectionReason;
        database.execute("UPDATE `Contributions` SET `Status` = ?, `RejectionReason` = ? WHERE `ContributionUUID` = ?", [status, rejectionReason, uuidAsBuf], function (scErr, scRes, scFields) {
            if (scErr) {
                return res.status(500).render("error", {
                    message: "The contribution could not be rejected."
                });
            } else {
                return res.redirect("/sa/contributions");
            }
        });
    } else {
        return res.status(400).render("error", {
            message: "The request was malformed."
        });
    }
});


module.exports = function (c, d) {
    config = c
    database = d;

    return server;
}