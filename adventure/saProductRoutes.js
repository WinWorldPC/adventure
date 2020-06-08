var express = require("express"),
    fs = require("fs"),
    path = require("path"),
    middleware = require("./middleware.js"),
    formatting = require("./formatting.js");

var config, database, sitePages;

var restrictedRoute = middleware.restrictedRoute;
var urlencodedParser = middleware.bodyParser;
var server = express.Router();

server.get("/sa/product/:product", restrictedRoute("sa"), function (req, res) {
    database.execute("SELECT * FROM `Products` WHERE `ProductUUID` = ?", [formatting.hexToBin(req.params.product)], function (prErr, prRes, prFields) {
        database.execute("SELECT `Name`,`ReleaseUUID` FROM `Releases` WHERE `ProductUUID` = ?", [formatting.hexToBin(req.params.product)], function (rlErr, rlRes, rlFields) {
            var product = prRes[0] || null;
            var releases = rlRes.map(function (x) {
                x.ReleaseUUID = formatting.binToHex(x.ReleaseUUID);
                return x;
            });
            if (prErr || product == null) {
                return res.status(404).render("error", {
                    message: "There is no product."
                });
            }
            product.ProductUUID = formatting.binToHex(product.ProductUUID);
            if (product.DefaultRelease) {
                product.DefaultRelease = formatting.binToHex(product.DefaultRelease);
            }

            var presetIcons = [];
            var iconPath = path.join(config.resDirectory, "img", "preset");
            var iconFiles = fs.readdirSync(iconPath);
            iconFiles.forEach(function (element, index, array) {
                presetIcons.push([
                    element,
                    path.join("/" + iconPath, element)
                    ]);
            });

            return res.render("saProduct", {
                product: product,
                releases: releases,
                tagMappingsInverted: formatting.invertObject(config.constants.tagMappings),
                categoryMappings: config.constants.categoryMappings,
                categoryMappingsInverted: formatting.invertObject(config.constants.categoryMappings),
                presetIcons : presetIcons
            });
        });
    });
});

server.post("/sa/addIcon/:product", restrictedRoute("sa"), uploadParser.single("iconFile"), function (req, res) {
    if (req.file && req.body) {
        var uuid = req.params.release;
        var uuidAsBuf = formatting.hexToBin(uuid);

        if (!req.file.mimetype.startsWith("image/")) {
            return res.status(400).render("error", {
                message: "The file wasn't an image."
            });
        }
        var ext = path.extname(req.file.originalname);

        // generate a filename by making a random filename and appending ext
        var fileName = formatting.createSalt() + ext;
        // TODO: Make this configuratable
        var fullPath = path.join(config.resDirectory, "img", "custom-icon", fileName);
        var dbParams = [uuidAsBuf, fileName, req.body.screenshotTitle];
        database.execute("INSERT INTO `Screenshots` (ReleaseUUID, ScreenshotFile, ScreenshotTitle) VALUES (?, ?, ?)", dbParams, function (seErr, seRes, seFields) {
            if (seErr) {
                return res.status(500).render("error", {
                    message: "The screenshot could not be added to the database."
                });
            } else {
                fs.writeFile(fullPath, req.file.buffer, function (err) {
                    if (err) {
                        return res.status(500).render("error", {
                            message: "The screenshot could not be written to disk."
                        });
                    } else {
                        return res.redirect("/sa/release/" + uuid);
                    }
                });
            }
        });
    } else {
        return res.status(400).render("error", {
            message: "The request was malformed."
        });
    }
});

server.post("/sa/editProductMetadata/:product", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.body && req.params.product && formatting.isHexString(req.params.product)) {
        var uuid = req.params.product;
        var defaultRelease = req.body.defaultRelease || "";   
        var defaultReleaseAsUuid = formatting.isHexString(defaultRelease) ? formatting.hexToBin(defaultRelease) : null;
        var applicationTags = formatting.dbStringifySelect(req.body.applicationTags);
        var dbParams = [req.body.name, req.body.slug, req.body.notes, req.body.type, applicationTags, defaultReleaseAsUuid, formatting.hexToBin(uuid)];
        database.execute("UPDATE Products SET Name = ?, Slug = ?, Notes = ?, Type = ?, ApplicationTags = ?, DefaultRelease = ? WHERE ProductUUID = ?", dbParams, function (prErr, prRes, prFields) {
            if (prErr) {
                return res.status(500).render("error", {
                    message: "The product could not be edited."
                });
            } else {
                return res.redirect("/product/" + req.body.slug);
            }
        });
    } else {
        return res.status(404).render("error", {
            message: "The request was malformed."
        });
    }
});

server.get("/sa/deleteProduct/:product", restrictedRoute("sa"), function (req, res) {
    if (req.params.product && formatting.isHexString(req.params.product) && req.query && req.query.yesPlease) {
        var uuidAsBuf = formatting.hexToBin(req.params.product);

        database.execute("DELETE FROM Products WHERE ProductUUID = ?", [uuidAsBuf], function (prErr, prRes, prFields) {
            if (prErr) {
                return res.status(500).render("error", {
                    message: "There was an error removing the product."
                });
            } else {
                return res.redirect("/library");
            }
        });
    } else {
        return res.status(400).render("error", {
            message: "The request was malformed, or you weren't certain."
        });
    }
});

server.get("/sa/createProduct", restrictedRoute("sa"), function (req, res) {
    return res.render("saCreateProduct", {
        slug: req.query.slug || ""
    });
});

server.post("/sa/createProduct", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    const getNewProductQuery = "SELECT * FROM `Products` WHERE `Name` = ? && `Slug` = ?";

    if (req.body && req.body.slug && req.body.name) {
        // check for dupe
        var slug = req.body.slug;
        var name = req.body.name;
        var dbParams = [name, slug];
        database.execute(getNewProductQuery, dbParams, function (dbErr, dbRes, dbFields) {
            if (dbErr || dbRes == null) {
                return res.status(500).render("error", {
                    message: "There was an error checking the database."
                });
            } else if (dbRes.length > 0) {
                return res.status(409).render("error", {
                    message: "There is already a product with that slug."
                });
            } else {
                // HACK: for old DB structure
                database.execute("INSERT INTO Products (Name, Slug, Type, Notes, DiscussionUUID) VALUES (?, ?, 'Application', '', 0x00000000000000000000000000000000)", dbParams, function (inErr, inRes, inFields) {
                    if (inErr) {
                        return res.status(500).render("error", {
                            message: "There was an error creating the item."
                        });
                    } else {
                        database.execute(getNewProductQuery, dbParams, function (prErr, prRes, prFields) {
                            if (prErr || prRes == null || prRes.length == 0) {
                                return res.status(500).render("error", {
                                    message: "There was an error validating the item."
                                });
                            } else {
                                return res.redirect("/product/" + prRes[0].Slug);
                            }
                        });
                    }
                });
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

    return server;
}