// Garbage collection script

var fs = require("fs"),
    database = require("./database.js");

var config = JSON.parse(fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""));

database.createConnection(config.mysql);

const downloadHitsQuery = "DELETE FROM DownloadHits WHERE DATE_SUB(DownloadTime,INTERVAL 1 DAY) > CURDATE()";

database.execute(downloadHitsQuery, [], function (dhErr, dhRes, dhFields) {
    if (dhErr) {
        console.log(dhErr);
    } else {
        console.log("Deleted stable download hits");
    }
});