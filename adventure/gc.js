// Garbage collection script

var fs = require("fs"),
    database = require("./database.js");

var config = JSON.parse(fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""));

database.createConnection(config.mysql);

const downloadHitsQuery = "DELETE FROM DownloadHits WHERE DATE_SUB(CURDATE(), INTERVAL 1 DAY) > DownloadTime";
const recoverRequestsQuery = "DELETE FROM UserRecoverPasswordRequests WHERE DATE_SUB(CURDATE(), INTERVAL 1 DAY) > DateCreated";

database.execute(downloadHitsQuery, [], function (dhErr, dhRes, dhFields) {
    if (dhErr) {
        console.log(dhErr);
    } else {
        console.log("Deleted stale download hits");
        database.execute(downloadHitsQuery, [], function (rpErr, rpRes, rpFields) {
            if (rpErr) {
                console.log(rpErr);
            } else {
                console.log("Deleted stale recover password requests");
                process.exit(0);
            }
        });
    }
});