var express = require("express"),
    fs = require("fs"),
    path = require("path"),
    marked = require("marked"),
    constants = require("./constants.js"),
    middleware = require("./middleware.js"),
    formatting = require("./formatting.js");

var config, database, sitePages;

var restrictedRoute = middleware.restrictedRoute;
var urlencodedParser = middleware.bodyParser;
var server = express.Router();

// this will soak up anything without routes on root
server.get("/:page", function (req, res) {
    if (sitePages[req.params.page]) {
        if (sitePages[req.params.page].redirectTo) {
            res.redirect(sitePages[req.params.page].redirectTo);
        } else {
            var file = path.join(config.pageDirectory, req.params.page + ".md");
            fs.readFile(file, "utf8", function (err, contents) {
                if (err) {
                    return res.status(500).render("error", {
                        message: "The page could not be loaded."
                    });
                }
                var page = marked(contents);
                var title = sitePages[req.params.page].title;
                var supressTitle = sitePages[req.params.page].supressTitle || false;
                return res.render("page", {
                    page: page,
                    title: title,
                    supressTitle: supressTitle
                });
            });
        }
    } else {
        return res.status(404).render("error", {
            message: "There is no page by this name."
        });
    }
});
server.get("/", function (req, res) {
    return res.redirect("/home");
});

module.exports = function (c, d, p) {
    config = c
    database = d;
    sitePages = p;

    return server;
}