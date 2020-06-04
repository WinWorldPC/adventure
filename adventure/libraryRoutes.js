var express = require("express"),
    bodyParser = require("body-parser"),
    path = require("path"),
    marked = require("marked"),
    rss = require("rss"),
    middleware = require("./middleware.js"),
    formatting = require("./formatting.js");

var config, database, sitePages;

var restrictedRoute = middleware.restrictedRoute;
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var server = express.Router();

// Library routes
function libraryRoute(req, res) {
    var page = req.query.page || 1;
    var category = "%"; // % for everything
    switch (req.params.category) {
        case "operating-systems":
            category = "OS";
            break;
        case "sys":
            category = "System";
            break
        case "games":
            category = "Game";
            break;
        case "dev":
            category = "DevTool";
            break;
        case "applications":
            category = "Application";
            break;
        default:
            return res.status(400).render("error", {
                message: "The category given was invalid."
            });
    }
    
    const productPlatforms = "(SELECT GROUP_CONCAT(DISTINCT Platform) FROM Releases WHERE ProductUUID = Products.ProductUUID)";
    
    if (category == "OS" && config.specialCaseLibraryOS) {
        database.execute("SELECT `Name`,`Slug`," + productPlatforms + " AS Platform FROM `Products` WHERE `Type` LIKE 'OS' ORDER BY `Name`", [], function (prErr, prRes, prFields) {
            var products = prRes.map(function (x) {
                x.Platform = x.Platform.split(",");
                return x;
            });
            
            var dos = products.filter(function (x) {
                return x.Platform.indexOf("DOS") > -1 || x.Platform.indexOf("CPM") > -1;
            });
            var nix = products.filter(function (x) {
                return x.Platform.indexOf("Unix") > -1 || x.Platform.indexOf("Linux") > -1;
            });
            var mac = products.filter(function (x) {
                return x.Platform.indexOf("MacOS") > -1 || x.Platform.indexOf("Mac OS X") > -1;
            });
            var win = products.filter(function (x) {
                return x.Platform.indexOf("Windows") > -1;
            });
            var os2 = products.filter(function (x) {
                return x.Platform.indexOf("OS2") > -1;
            });
            var other = products.filter(function (x) {
                return x.Platform.indexOf("Other") > -1 || x.Platform.indexOf("DOSShell") > -1;
            });
            
            return res.render("libraryOS", {
                dos: dos,
                nix: nix,
                mac: mac,
                win: win,
                os2: os2,
                other: other,

                categoryMappings: config.constants.categoryMappings,
                categoryMappingsInverted: formatting.invertObject(config.constants.categoryMappings)
            });
        });
    } else {
        var tag = null;
        var platform = null;
        // TODO: Support richer tag queries than the bare-minimum compat we have
        // with old site (because library pages link to tags in descriptions)
        if (req.params.tag != null) {
            if (req.params.tag.indexOf("tag-") == 0) {
                tag = config.constants.tagMappings[req.params.tag] || null;
            } else if (req.params.tag.indexOf("platform-") == 0) {
                platform = config.constants.platformMappings[req.params.tag] || null;
            }
        }
        // HACK: I am EXTREMELY not proud of ANY of these queries
        // they need UDFs and building on demand BADLY
        database.execute("SELECT COUNT(*)," + productPlatforms + " AS Platform FROM `Products` WHERE `Type` LIKE ? && IF(? LIKE '%', ApplicationTags LIKE CONCAT(\"%\", ?, \"%\"), TRUE) && IF(? LIKE '%', " + productPlatforms + " LIKE CONCAT(\"%\", ?, \"%\"), TRUE)", [category, tag, tag, platform, platform], function (cErr, cRes, cFields) {
            var count = cRes[0]["COUNT(*)"];
            var pages = Math.ceil(count / config.perPage);
            // TODO: Break up these queries, BADLY
            database.execute("SELECT `Name`,`Slug`,`ApplicationTags`,`Notes`,`Type`," + productPlatforms + " AS Platform FROM `Products` HAVING `Type` LIKE ? && IF(? LIKE '%', ApplicationTags LIKE CONCAT(\"%\", ?, \"%\"), TRUE) && IF(? LIKE '%', Platform LIKE CONCAT(\"%\", ?, \"%\"), TRUE) ORDER BY `Name` LIMIT ?,?", [category, tag, tag, platform, platform, (page - 1) * config.perPage, config.perPage], function (prErr, prRes, prFields) {
                // truncate and markdown
                var productsFormatted = prRes.map(function (x) {
                    x.Notes = marked(formatting.truncateToFirstParagraph(x.Notes));
                    return x;
                })
                // TODO: Special-case OS for rendering the old custom layout
                res.render("library", {
                    products: productsFormatted,
                    page: page,
                    pages: pages,
                    category: req.params.category,
                    tag: req.params.tag,
                    tagMappingsInverted: formatting.invertObject(config.constants.tagMappings),
                    platformMappingsInverted: formatting.invertObject(config.constants.platformMappings),
                    categoryMappings: config.constants.categoryMappings,
                    categoryMappingsInverted: formatting.invertObject(config.constants.categoryMappings)
                });
            });
        });
    }
}
server.get("/library/:category", libraryRoute);
server.get("/library/:category/:tag", libraryRoute);
server.get("/library", function (req, res) {
    return res.redirect("/library/" + config.defaultCategory);
});

server.get("/search-help", function (req, res) {
    return res.render("searchHelp", {
    });
});

server.get("/search", function (req, res) {
    // TODO: Fold all this back into the main library display route so users can trivially move from displaying a whole category or tag to a more specific search; most of it's equivalent functionality anyway, we just need a flag to hide the search details field in the template (and the release details if/when that's implemented) - however, if the user clicks a link like "Advanced Search", their current view will be transformed into a search query

    var page = req.query.page || 1;

    // Is there a search term?
    if (req.query.q) {
        var searchTerm = req.query.q; // This is the search as it will be displayed in the results
        var search = '%' + searchTerm + '%'; // This is the actual query we'll put in the SQL
    } else {
        // Blank searches are allowed so user can e.g. find all items by year
        // TODO: Throw an error if NO fields were populated
        var searchTerm = "";
        var search = "%";
    }

    var tagQuery = "";
    var tagSet = [];
    // Are there any tags?
    if (req.query.tags) {
        // Convert input query to array if needed
        if (Array.isArray(req.query.tags)) {
            var tags = req.query.tags; // User selected multiple items
        } else {
            var tags = [req.query.tags]; // User selected one item
        }
        var tagQueries = [];
        tags.forEach(tag => {
            // Make sure each platform is valid to prevent SQL injection
            if (formatting.invertObject(config.constants.tagMappings).hasOwnProperty(tag)) {
                tagQueries.push("find_in_set('" + tag + "', Products.ApplicationTags)");
                tagSet.push(tag);
            }
        });
        tagQuery = tagQueries.join(" OR ");
    }
    if (tagQuery == "") tagQuery = "TRUE";

    var platformQuery = "";
    var platformSet = [];
    // Are there any platforms?
    if (req.query.platforms) {
        // Convert input query to array if needed
        if (Array.isArray(req.query.platforms)) {
            var platforms = req.query.platforms; // User selected multiple items
        } else {
            var platforms = [req.query.platforms]; // User selected one item
        }
        var platformQueries = [];
        platforms.forEach(platform => {
            // Make sure each platform is valid to prevent SQL injection
            if (formatting.invertObject(config.constants.platformMappings).hasOwnProperty(platform)) {
                platformQueries.push("find_in_set('" + platform + "', Releases.Platform)");
                platformSet.push(platform);
            }
        });
        platformQuery = platformQueries.join(" OR ");
    }
    if (platformQuery == "") platformQuery = "TRUE";

    var startYear = "0000";
    // Is there a valid start year?
    if (req.query.startYear && !isNaN(Number(req.query.startYear))) {
        startYear = Number(req.query.startYear);
    }
    var endYear = "9999";
    // Is there a valid end year?
    if (req.query.endYear && !isNaN(Number(req.query.endYear))) {
        endYear = Number(req.query.endYear);
    }

    // Get "search description" checkbox
    var descField = (req.query.descField) ? true : false;
    // Get vendor field
    var vendor = (req.query.vendor) ? req.query.vendor : "%";

    // Assemble the list of fields to be matched with fulltext search
    ftsMatchFields = ["Products.Name"];
    if (descField) ftsMatchFields.push("Products.Notes");
    matchFields = ftsMatchFields.join(", ");

    // If user entered no fulltext search value, crowbar out the fulltext search
    var ftsEnabled = "";
    if (searchTerm == "") ftsEnabled = "OR TRUE";

    // We need to build the core part of the query so it'll be identical in both the count/pagination query, the content query, and the release aggregator query (in that order)

    // First, the "details" (this goes into the core query and the release query)
    var detailsQuery = "AND year(Releases.ReleaseDate) >= '" + startYear + "' \n\
            AND year(Releases.ReleaseDate) <= '" + endYear + "' \n\
            AND ("+ platformQuery + ")\n\
            AND Releases.VendorName LIKE ?\n";

    // Now the "core" which filters for which products match at all
    var coreQuery = "(MATCH(" + matchFields +") AGAINST (? IN BOOLEAN MODE) "+ftsEnabled+") \n\
        AND Products.ProductUUID IN (\n\
            SELECT ProductUUID FROM Releases \n\
            WHERE \n\
            Releases.ProductUUID = Products.ProductUUID \n"
            + detailsQuery +
        ") \n\
        AND ("+ tagQuery +")";

    // HACK: I am EXTREMELY not proud of ANY of these queries
    // they need UDFs and building on demand BADLY

    // Now let's start querying
    // First get count of matching rows so we can paginate
    database.execute("SELECT COUNT(*) FROM `Products` WHERE " + coreQuery,
        [search, vendor], function (cErr, cRes, cFields) {
            if (!cRes) {
                return res.status(404).render("error", {
                    message: "Search engine error."
                });
            }
        var count = cRes[0]["COUNT(*)"];
        var pages = Math.ceil(count / config.perPage);

        // Now do the actual content query, limiting to the extents of the currently selected page
        // TODO: Once column sorting is implemented, will need to add ORDER BY clause here
        database.execute("SELECT Products.`Name`,Products.`Slug`,Products.`ApplicationTags`,Products.`Notes`,Products.`Type`,Products.`ProductUUID`,HEX(Products.`ProductUUID`) AS PUID From `Products` HAVING " + coreQuery + " LIMIT ?,?",
             [search, vendor, (page - 1) * config.perPage, config.perPage], function (prErr, prRes, prFields) {

                // This is used by the Markdown renderer to turn links into bold text
                var renderer = new marked.Renderer();
                renderer.link = function (href, title, text) {
                    return "<strong>" + text + "</strong>";
                };
                // Now truncate and render markdown for the description field
                var productsFormatted = prRes.map(function (x) {
                    x.Notes = marked(formatting.truncateToFirstParagraph(x.Notes), { renderer: renderer });
                    return x;
                })

                // Accumulate a list of all product UUIDs that matched
                var prodUUIDs = prRes.map(function (x) {
                    return "0x" + x.PUID;
                });

                // If there were no products returned, put in a bogus value, otherwise the next query will fail
                prodUUIDString = (prodUUIDs.length > 0) ? prodUUIDs.join(',') : "''";

                // Now do another query which will get all releases for each of the matching products
                // TODO: This might be refactorable as a JOIN against the previous query. I felt that was "dirty" since I'd have to manipulate the data a ton in JS, but now I'm thinking this is maybe dirtier. It does work, but it's probably slower than it needs to be.
                var releasesCollection = {};
                database.execute("SELECT *, HEX(ProductUUID) as PUID From `Releases` WHERE Releases.ProductUUID IN ("+ prodUUIDString +") " + detailsQuery,
                    [vendor], function (relErr, relRes, relFields) {
                        // Build a dict of all the releases for each ProductUUID
                        relRes.forEach(relRow => {
                            PUID = relRow.PUID;
                            if (!releasesCollection.hasOwnProperty(PUID)) releasesCollection[PUID] = [];
                            releasesCollection[PUID].push(relRow);
                            console.log(releasesCollection);
                        });

                        // Render the page
                        // TODO: Special-case OS for rendering the old custom layout
                        res.render("search", {
                            search: searchTerm,
                            products: productsFormatted,
                            page: page,
                            pages: pages,
                            category: req.params.category,
                            tag: req.params.tag,
                            tags: tags,
                            tagMappingsInverted: formatting.invertObject(config.constants.tagMappings),
                            tags: Object.values(config.constants.tagMappings),
                            platformMappings: config.constants.platformMappings,
                            platformMappingsInverted: formatting.invertObject(config.constants.platformMappings),
                            platforms: Object.values(config.constants.platformMappings),
                            categoryMappings: config.constants.categoryMappings,
                            categoryMappingsInverted: formatting.invertObject(config.constants.categoryMappings),
                            startYear: startYear > 0000 ? startYear : "",
                            endYear: endYear < 9999 ? endYear : "",
                            tagSet: tagSet,
                            platformSet, platformSet,
                            vendor: (vendor == "%") ? "" : vendor,
                            descField: descField,
                            releasesCollection: releasesCollection
                        });
                    });
        });
    });


    return;
});


// TODO: Experimental view; VIPs only for now now that auth works
function filesRoute(req, res) {
    var page = req.query.page || 1;
    // Downloads without releases associated are essentially orphans that should be GCed
    database.execute("SELECT COUNT(*) FROM `Downloads` WHERE `ReleaseUUID` IS NOT NULL", function (cErr, cRes, cFields) {
        var count = cRes[0]["COUNT(*)"];
        var pages = Math.ceil(count / config.perPage);
        database.execute("SELECT * FROM `Downloads` WHERE `ReleaseUUID` IS NOT NULL ORDER BY `FileName` LIMIT ?,?", [(page - 1) * config.perPage, config.perPage], function (fiErr, fiRes, fiFields) {
            var files = fiRes.map(function (x) {
                x.FileSize = formatting.formatBytes(x.FileSize);
                x.ImageType = config.constants.fileTypeMappings[x.ImageType];
                x.DLUUID = formatting.binToHex(x.DLUUID);
                x.ReleaseUUID = formatting.binToHex(x.ReleaseUUID);
                return x;
            });
            res.render("files", {
                page: page,
                pages: pages,
                files: files
            });
        });
    });
}
server.get("/files/", restrictedRoute("vip"), filesRoute);

server.get("/product/:product", function (req, res) {
    database.execute("SELECT * FROM `Products` WHERE `Slug` = ?", [req.params.product], function (prErr, prRes, prFields) {
        var product = prRes[0] || null;
        if (product == null) {
            if (req.user && req.user.UserFlags.some(function (x) { return x.FlagName == "sa"; })) {
                req.flash("warning", "There was no product. You can create one now.");
                return res.redirect("/sa/createProduct?slug=" + req.params.product);
            } else {
                return res.status(404).render("error", {
                    message: "There was no product."
                });
            }
        }
        
        var fallback = function () {
            database.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? ORDER BY `ReleaseDate`", [product.ProductUUID], function (rlErr, rlRes, rlFields) {
                var release = rlRes[0] || null;
                if (release) {
                    return res.redirect("/product/" + product.Slug + "/" + release.Slug);
                } else {
                    if (req.user && req.user.UserFlags.some(function (x) { return x.FlagName == "sa"; })) {
                        req.flash("warning", "The product has no releases. You can create one now.");
                        return res.redirect("/sa/createRelease/" + formatting.binToHex(product.ProductUUID));
                    } else {
                        return res.status(404).render("error", {
                            message: "The product has no releases."
                        });
                    }
                }
            });
        };
        
        if (product.DefaultRelease) {
            database.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? AND `ReleaseUUID` = ?", [product.ProductUUID, product.DefaultRelease], function (reErr, reRes, reFields) {
                var release = reRes[0] || null;
                if (release) {
                    return res.redirect("/product/" + product.Slug + "/" + release.Slug);
                } else {
                    return fallback();
                }
            });
        } else {
            return fallback();
        }
    });
});

server.get("/product/:product/:release", function (req, res) {
    database.execute("SELECT * FROM `Products` WHERE `Slug` = ?", [req.params.product], function (prErr, prRes, prFields) {
        var product = prRes[0] || null;
        if (product == null) {
            if (req.user && req.user.UserFlags.some(function (x) { return x.FlagName == "sa"; })) {
                req.flash("warning", "There was no product. You can create one now.");
                return res.redirect("/sa/createProduct?slug=" + req.params.product);
            } else {
                return res.status(404).render("error", {
                    message: "There was no product."
                });
            }
        }
        
        database.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? ORDER BY `ReleaseDate`", [product.ProductUUID], function (rlErr, rlRes, rlFields) {
            if (rlRes == null || rlRes.length == 0) {
                if (req.user && req.user.UserFlags.some(function (x) { return x.FlagName == "sa"; })) {
                    req.flash("warning", "The product has no releases. You can create one now.");
                    return res.redirect("/sa/createRelease/" + formatting.binToHex(product.ProductUUID));
                } else {
                    return res.status(404).render("error", {
                        message: "The product has no releases."
                    });
                }
            }
            var release = rlRes.find(function (x) {
                if (x.Slug == req.params.release)
                    return x;
            });
            if (release == null) {
                if (req.user && req.user.UserFlags.some(function (x) { return x.FlagName == "sa"; })) {
                    req.flash("warning", "The product has no release by that name. You can create one now.");
                    return res.redirect("/sa/createRelease/" + formatting.binToHex(product.ProductUUID) + "?slug=" + req.params.release);
                } else {
                    return res.status(404).render("error", {
                        message: "There was no release by that name."
                    });
                }
            }
            database.execute("SELECT * FROM `Serials` WHERE `ReleaseUUID` = ?", [release.ReleaseUUID], function (seErr, seRes, seFields) {
                database.execute("SELECT * FROM `Screenshots` WHERE `ReleaseUUID` = ?", [release.ReleaseUUID], function (scErr, scRes, scFields) {
                    database.execute("SELECT * FROM `Downloads` WHERE `ReleaseUUID` = ? ORDER BY `Name`", [release.ReleaseUUID], function (dlErr, dlRes, dlFields) {
                        release.InstallInstructions = marked(release.InstallInstructions || "");
                        release.Notes = marked(release.Notes || "");
                        product.Notes = marked(product.Notes || "");
                        release.ReleaseUUID = formatting.binToHex(release.ReleaseUUID);
                        product.ProductUUID = formatting.binToHex(product.ProductUUID);
                        // format beforehand, rather than in rendering or client end
                        release.RAMRequirement = formatting.formatBytes(release.RAMRequirement);
                        release.DiskSpaceRequired = formatting.formatBytes(release.DiskSpaceRequired);
                        var downloads = dlRes.map(function (x) {
                            x.FileSize = formatting.formatBytes(x.FileSize);
                            x.ImageType = config.constants.fileTypeMappings[x.ImageType];
                            x.DLUUID = formatting.binToHex(x.DLUUID);
                            return x;
                        });
                        var screenshots = scRes == null ? null : scRes.map(function (x) {
                            x.ScreenshotFile = config.screenshotBaseUrl + x.ScreenshotFile;
                            x.ScreenshotUUID = formatting.binToHex(x.ScreenshotUUID);
                            return x;
                        });

                        // for vanilla
                        var ssoString;
                        if (config.useVanilla && req.user) {
                            var builtObject = {
                                email: req.user.Email,
                                name: req.user.ShortName,
                                roles: "member",
                                uniqueid: formatting.binToHex(req.user.UserID),
                            };
                            if (req.user.UserFlags.some(function (x) { return x.FlagName == "vip"; })) {
                                builtObject.roles += ",VIP";
                            }
                            if (req.user.UserFlags.some(function (x) { return x.FlagName == "sa"; })) {
                                builtObject.roles += ",administrator";
                            }
                            builtObject.client_id = config.vanillaClientId;
                            var jsonObject = JSON.stringify(builtObject);
                            var b64Object = formatting.b64encode(jsonObject);
                            var ts = Date.now().toString();
                            var sign = formatting.hmacsha1(b64Object + " " + ts, config.vanillaSecret);
                            ssoString = b64Object + " " + sign + " " + ts + " hmacsha1";
                        }

                        res.render("release", {
                            product: product,
                            releases: rlRes,
                            release: release,
                            serials: seRes,
                            screenshots: screenshots,
                            downloads: downloads,

                            tagMappingsInverted: formatting.invertObject(config.constants.tagMappings),
                            platformMappingsInverted: formatting.invertObject(config.constants.tagMappings),
                            categoryMappings: config.constants.categoryMappings,
                            categoryMappingsInverted: formatting.invertObject(config.constants.categoryMappings),

                            ssoString: ssoString
                        });
                    });
                });
            });
        });
    });
});

server.get("/screenshot/:release/:screenshot", function (req, res) {
    var uuid = req.params.screenshot;
    var uuidAsBuf = formatting.hexToBin(uuid);
    database.execute("SELECT * FROM `Screenshots` WHERE `ScreenshotUUID` = ?", [uuidAsBuf], function (scErr, scRes, scFields) {
        if (scErr || scRes == null || scRes.length == 0) {
            return res.status(404).render("error", {
                message: "There was no screenshot."
            });
        } else {
            var screenshot = scRes[0];
            screenshot.ScreenshotFile = config.screenshotBaseUrl + screenshot.ScreenshotFile;
            screenshot.ScreenshotUUID = formatting.binToHex(screenshot.ScreenshotUUID);
            res.render("screenshot", {
                title: screenshot.ScreenshotTitle,
                file: screenshot.ScreenshotFile,
                uuid: screenshot.ScreenshotUUID,
                release: req.params.release
            });
        }
    });
});

server.get("/release/:id", function (req, res) {
    if (formatting.isHexString(req.params.id)) {
        var uuid = formatting.hexToBin(req.params.id);
        database.execute("SELECT `ReleaseUUID`,`Slug`,`ProductUUID` FROM `Releases` WHERE `ReleaseUUID` = ?", [uuid], function (rlErr, rlRes, rlFields) {
            var release = rlRes[0] || null;
            if (release == null) {
                return res.status(404).render("error", {
                    message: "There was no release."
                });
            }
            database.execute("SELECT `Slug`,`ProductUUID` FROM `Products` WHERE `ProductUUID` = ?", [release.ProductUUID], function (prErr, prRes, prFields) {
                var product = prRes[0] || null;
                
                if (product == null) {
                    if (req.user && req.user.UserFlags.some(function (x) { return x.FlagName == "sa"; })) {
                        return res.redirect("/sa/release/" + req.params.id);
                    } else {
                        return res.status(404).render("error", {
                            message: "There was no product associated."
                        });
                    }
                } else {
                    return res.redirect("/product/" + product.Slug + "/" + release.Slug);
                }
            });
        });
    } else {
        return res.status(400).render("error", {
            message: "The ID given was malformed."
        });
    }
});

server.get("/downloads/latest.rss", function (req, res) {
    var feed = new rss({
        title: "Latest downloads",
        generator: "Adventure",
        feed_url: config.publicBaseUrl + "downloads/latest.rss",
        site_url: config.publicBaseUrl,
    });

    // Use LastUpdated instead?
    database.execute("SELECT * FROM `Downloads` ORDER BY CreatedDate DESC LIMIT 10", [], function (dlErr, dlRes, dlFields) {
        if (dlErr || dlRes.length == 0) {
            return res.sendStatus(500);
        } else {
            dlRes.map(function (x) {
                x.DLUUID = formatting.binToHex(x.DLUUID);
                return x;
            }).forEach(function (i, n, a) {
                feed.item({
                    title: i.Name,
                    guid: i.DLUUID,
                    description: marked(i.Information || ""),
                    url: config.publicBaseUrl + "download/" + i.DLUUID,
                    date: i.CreatedDate,
                    //custom_elements: [
                    //    { "adventure:version": i.Version },
                    //    { "adventure:rtm": i.RTM },
                    //    { "adventure:upgrade": i.Upgrade },
                    //    { "adventure:language": i.Language },
                    //    { "adventure:arch": i.Arch },
                    //    { "adventure:file_type": config.constants.fileTypeMappings[i.ImageType] },
                    //    { "adventure:file_size": formatting.formatBytes(i.FileSize) },
                    //    { "adventure:sha1": formatting.binToHex(i.SHA1Sum) },
                    //]
                });
            });
            
            return res.type("application/rss+xml").send(feed.xml());
        }
    });
});

server.get("/download/test/", function (req, res) {
    database.execute("SELECT * FROM `DownloadMirrors` WHERE `IsOnline` = True", null, function (miErr, miRes, miFields) {
        res.render("test", {
            ip: req.ip,
            mirrors: miRes
        });
    });
});

server.get("/download/:download", function (req, res) {
    if (!formatting.isHexString(req.params.download)) {
        return res.status(400).render("error", {
            message: "The ID given was malformed."
        });
    }
    var uuidAsBuf = formatting.hexToBin(req.params.download);
    database.execute("SELECT * FROM `Downloads` WHERE `DLUUID` = ?", [uuidAsBuf], function (dlErr, dlRes, dlFields) {
        var download = dlRes[0] || null;
        if (dlErr || download == null) {
            console.log(dlErr || "[ERR] download was null! /download/" + req.params.download + " refererr: " + req.get("Referrer"));
            return res.status(404).render("error", {
                message: "There was no download."
            });
        }
        database.execute("SELECT * FROM `MirrorContents` WHERE `DownloadUUID` = ?", [uuidAsBuf], function (mrErr, mrRes, mrFields) {
            database.execute("SELECT * FROM `DownloadMirrors` WHERE `IsOnline` = True", null, function (miErr, miRes, miFields) {
                database.execute("SELECT * FROM `DownloadHits` WHERE IPAddress = ? AND DownloadTime > CURDATE()", [req.ip], function (idhErr, idhRes, idhFields) {
                    const anonymousMax = config.downloadMax || 25;
                    var max = anonymousMax;
                    if (req.user) {
                        // Authenicated users get double
                        max *= 2;
                        if (req.user.UserFlags.some(function (x) { return x.FlagName == "vip"; })) {
                            // VIPs get a LOT more (is this reasonable?)
                            //max = Number.MAX_SAFE_INTEGER; // maybe not
                            max *= 4;
                        }
                    }
                    // filter out mirrors that aren't online and have the file
                    // HACK: arrays are NOT comparable, so turn them into strings
                    // then munge the buffer into an MU compatible UUID string
                    var mirrors = miRes.filter(function (x) {
                        return mrRes.map(function (y) {
                            return y.MirrorUUID.toString("hex");
                        }).indexOf(x.MirrorUUID.toString("hex")) > -1;
                    }).map(function (x) {
                        x.MirrorUUID = formatting.binToHex(x.MirrorUUID);
                        return x;
                    });;

                    if (download.Information) {
                        download.Information - marked(download.Information);
                    }
                    download.ImageType = config.constants.fileTypeMappings[download.ImageType];
                    download.FileSize = formatting.formatBytes(download.FileSize);
                    // turn these into the proper links
                    download.ReleaseUUID = formatting.binToHex(download.ReleaseUUID);
                    download.DLUUID = formatting.binToHex(download.DLUUID);
                    res.render("selectMirror", {
                        download: download, mirrors: mirrors,
                        usedDownloads: idhRes.length,
                        downloadLimit: max,
                    });
                });
            });
        });
    });
});

server.get("/download/:download/from/:mirror", function (req, res) {
    if (!(formatting.isHexString(req.params.download) && formatting.isHexString(req.params.mirror))) {
        return res.status(400).render("error", {
            message: "The ID given is malformed."
        });
    }
    // TODO: UUID compatiability
    // UUID format is like 60944f2b-4520-11e4-8d58-7054d21a8599/from/630d4e90-3d33-11e6-977e-525400b25447
    var uuidAsBuf = formatting.hexToBin(req.params.download);
    var mirrorUuidAsBuf = formatting.hexToBin(req.params.mirror);
    // check how many downloads where hit (no user/session just yet)
    database.execute("SELECT * FROM `DownloadHits` WHERE IPAddress = ? AND DownloadTime > CURDATE()", [req.ip], function (idhErr, idhRes, idhFields) {
        const anonymousMax = config.downloadMax || 25;
        var max = anonymousMax;
        if (req.user) {
            // Authenicated users get double
            max *= 2;
            if (req.user.UserFlags.some(function (x) { return x.FlagName == "vip"; })) {
                // VIPs get a LOT more (is this reasonable?)
                //max = Number.MAX_SAFE_INTEGER; // maybe not
                max *= 4;
            }
        }
        if (idhRes.length > max) {
            return res.status(429).render("error", {                
                message: "You are trying to download too many times. Wait a while, or log in if you haven't to access more."
            });
        }
        database.execute("SELECT * FROM `Downloads` WHERE `DLUUID` = ?", [uuidAsBuf], function (dlErr, dlRes, dlFields) {
            var download = dlRes[0] || null;
            if (dlErr || download == null) {
                console.log(dlErr || "[ERR] download was null! /download/" + req.params.download + "/from/" + req.params.mirror + " refererr: " + req.get("Referrer"));
                return res.status(500).render("error", {
                    message: "There was no download."
                });
            }
            database.execute("SELECT * FROM `MirrorContents` WHERE `DownloadUUID` = ?", [uuidAsBuf], function (mrErr, mrRes, mrFields) {
                database.execute("SELECT * FROM `DownloadMirrors` WHERE `MirrorUUID` = ?", [mirrorUuidAsBuf], function (miErr, miRes, miFields) {
                    var mirror = miRes[0] || null;
                    if (miErr || mirror == null) {
                        console.log(miErr || "[ERR] mirror was null! /download/" + req.params.download + "/from/" + req.params.mirror + " refererr: " + req.get("Referrer"));
                        return res.status(500).render("error", {
                            message: "The was no mirror."
                        });
                    }
                    // TODO: I think escape sequences may need to be replaced too?
                    var downloadPath = "http://" + mirror.Hostname + "/" + download.DownloadPath;//.replace("&", "+");
                    database.execute("INSERT INTO `DownloadHits` (DownloadUUID, MirrorUUID, IPAddress) VALUES (?, ?, ?)", [uuidAsBuf, mirrorUuidAsBuf, req.ip], function (dhErr, dhRes, dhFields) {
                        return res.redirect(downloadPath);
                    });
                });
            });
        });
    });
});

server.post("/check-x-sendfile", urlencodedParser, function (req, res) {
    if (req.body.ip == null || req.body.file == null) {
        console.log("[ERR] check-x-sendfile failed! ip: " + req.body.ip + " file: " + req.body.file)
        return res.status(400).send("false");
    }
    var file = req.body.file;
    console.log("[INFO] check-x-sendfile: url encoded and decoded are " + file + " and " + decodeURIComponent(file));
    file = decodeURIComponent(file);
    var ip = req.body.ip;
    // mirror thing striped the initial ./ sometimes try with and without
    database.execute("SELECT DLUUID FROM `Downloads` WHERE `DownloadPath` = ? OR `DownloadPath` = CONCAT(\"./\", ?)", [file, file], function (dhErr, dhRes, dhFields) {
        var dl = dhRes[0] || null;
        if (dl == null) {
            console.log("[ERR] check-x-sendfile failed, null download! false for/on " + file + "/" + ip);
            return res.status(403).send("false");
        }
        database.execute("SELECT * FROM `DownloadHits` WHERE `IPAddress` = ? AND `DownloadUUID` = ?", [ip, dl.DLUUID], function (dhErr, dhRes, dhFields) {
            console.log("[INFO] check-x-sendfile: " + (dhRes.length ? "true" : "false") + " for/on " + file + " (" + formatting.binToHex(dl.DLUUID) + ")/" + ip);
            return res.send(dhRes.length ? "true" : ("potentially invalid download ID: " + formatting.binToHex(dl.DLUUID)));
        });
    });
});

module.exports = function (c, d, p) {
    config = c
    database = d;
    sitePages = p;
    
    return server;
}