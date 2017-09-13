module.exports = {
    roundToPrecision: function(number, precision) {
        var factor = Math.pow(10, precision);
        var tempNumber = number * factor;
        var roundedTempNumber = Math.round(tempNumber);
        return roundedTempNumber / factor;
    },
    
    formatBytes: function(size) {
        if (size) {
            var base = Math.log(size) / Math.log(1000);
            var suffixes = ["", "KB", "MB", "GB", "TB"];
            var ret = this.roundToPrecision(Math.pow(1000, base - Math.floor(base)), 2) + suffixes[Math.floor(base)];
            return ret || "0";
        } else return "0";
    },

    truncateToFirstParagraph: function (string) {
        // Handle Unix and Windows newlines
        return string.replace(/(.*)\r?\n.*/g, "$1");
    },
};