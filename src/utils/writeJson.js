const fs = require("fs");

module.exports = (data, fileName) => {
    fs.writeFile(`./output/${fileName}.json`, data, (err) => {
        if (err) {
            console.log(`Error writing ${fileName} file`, err);
        } else {
            console.log(`Successfully wrote ${fileName} file`);
        }
    });
};
