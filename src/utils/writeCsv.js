const jsonexport = require("jsonexport");
const fs = require("fs");

module.exports = (data, fileName) => {
    jsonexport(data, function (err, csv) {
        if (err) return console.error(err);

        fs.writeFile(`./files/${fileName}.csv`, csv, (err) => {
            if (err) throw err;
            console.log(`Successfully wrote ${fileName} file`);
        });
    });
};
