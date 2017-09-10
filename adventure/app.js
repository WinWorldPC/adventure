var express = require("express"),
    mysql = require("mysql2");

// obviously not production creds!
var connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "password",
    database: "winworld"
});

var server = express();

var urlencodedParser = bodyParser.urlencoded({ extended: false });

server.use("/static", express.static("static"));
server.set("views", "views");
server.set("view engine", 'ejs');

server.get("/library", function (req, res) {
    connection.execute("SELECT `Name`,`Slug` FROM `Products`", null, function (prErr, prRes, prFields) {
        // TODO: very slow! do pagination, badly!
        res.render("library", { products: prRes });
    });
});

server.get("/product/:product", function (req, res) {
    connection.execute("SELECT * FROM `Products` WHERE `Slug` = ?", [req.params.product], function (prErr, prRes, prFields) {
        var product = prRes[0] || null;
        if (product == null) return res.sendStatus(404);
        connection.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ?", [product.ProductUUID], function (rlErr, rlRes, rlFields) {
            var sortedReleases = rlRes.sort(function (a, b) {
                return a.ReleaseOrder - b.ReleaseOrder;
            });
            res.render("product", { product: product, releases: sortedReleases });
        });
    });
});

server.get("/product/:product/:release", function (req, res) {
    connection.execute("SELECT * FROM `Products` WHERE `Slug` = ?", [req.params.product], function (prErr, prRes, prFields) {
        var product = prRes[0] || null;
        if (product == null) return res.sendStatus(404);
        connection.execute("SELECT * FROM `Releases` WHERE `ProductUUID` = ? AND `Slug` = ?", [product.ProductUUID, req.params.release], function (rlErr, rlRes, rlFields) {
            var release = rlRes[0] || null;
            if (release == null) return res.sendStatus(404);
            connection.execute("SELECT * FROM `Serials` WHERE `ReleaseUUID` = ?", [release.ReleaseUUID], function (seErr, seRes, seFields) {
                connection.execute("SELECT * FROM `Downloads` WHERE `ReleaseUUID` = ?", [release.ReleaseUUID], function (dlErr, dlRes, dlFields) {
                    res.render("release", { product: product, release: release, serials: seRes, downloads: dlRes });
                });
            });
        });
    });
});

server.get("/download/:download", function (req, res) {
    // TODO: UUID compatiability
    // UUID format is like 60944f2b-4520-11e4-8d58-7054d21a8599/from/630d4e90-3d33-11e6-977e-525400b25447
    var uuidAsBuf = Buffer.from(req.params.download, "hex");
    connection.execute("SELECT * FROM `Downloads` WHERE `DLUUID` = ?", [uuidAsBuf], function (dlErr, dlRes, dlFields) {
        var download = dlRes[0] || null;
        connection.execute("SELECT * FROM `MirrorContents` WHERE `DownloadUUID` = ?", [uuidAsBuf], function (mrErr, mrRes, mrFields) {
            connection.execute("SELECT * FROM `DownloadMirrors` WHERE `IsOnline` = True", null, function (miErr, miRes, miFields) {
                // filter out mirrors that aren't online and have the file
                // HACK: arrays are NOT comparable, so turn them into strings
                var mirrors = miRes.filter(function (x) {
                    return mrRes.map(function (y) {
                        return y.MirrorUUID.toString("hex");
                    }).indexOf(x.MirrorUUID.toString("hex")) > -1;
                });
                res.render("selectMirror", { download: download, mirrors: mirrors });
            });
        });
    });
});

server.get("/download/:download/from/:mirror", function (req, res) {
    // TODO: UUID compatiability
    // UUID format is like 60944f2b-4520-11e4-8d58-7054d21a8599/from/630d4e90-3d33-11e6-977e-525400b25447
    var uuidAsBuf = Buffer.from(req.params.download, "hex");
    var mirrorUuidAsBuf = Buffer.from(req.params.mirror, "hex");
    connection.execute("SELECT * FROM `Downloads` WHERE `DLUUID` = ?", [uuidAsBuf], function (dlErr, dlRes, dlFields) {
        var download = dlRes[0] || null;
        connection.execute("SELECT * FROM `MirrorContents` WHERE `DownloadUUID` = ?", [uuidAsBuf], function (mrErr, mrRes, mrFields) {
            connection.execute("SELECT * FROM `DownloadMirrors` WHERE `MirrorUUID` = ?", [mirrorUuidAsBuf], function (miErr, miRes, miFields) {
                var mirror = miRes[0] || null;
                // TODO: I think escape sequences may need to be replaced too?
                var downloadPath = "http://" + mirror.Hostname + "/" + download.DownloadPath.replace("&", "+");
                // Put HL protection logic here
                return res.redirect(downloadPath);
            });
        });
    });
});

server.post("/check-x-sendfile", urlencodedParser, function (req, res) {
    var file = req.body.file;
    var ip = req.body.ip;
    // TODO: Put anti-HL protection logic here (uses DLHits table, xref w/ IP)
    return res.send("true");
});

server.listen(3000);