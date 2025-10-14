const axios = require("axios");
const csvToJson = require("csvtojson");

const _ = require("../src/Helpers");
const Airtable = require("../src/Airtable");
const slackNotification = require("../src/slackNotification");

const parseReonomy = require("../src/utils/parse/reonomy");
const parseReonomyExport = require("../src/utils/parse/reonomyExport");
const parseZoominfo = require("../src/utils/parse/zoominfo");
const parseZoominfoExport = require("../src/utils/parse/zoominfoExport");

const emailHandler = require("../src/utils/parse/emailHandler");
const textHandler = require("../src/utils/parse/textHandler");

const parse = async (record, baseID) => {
    if (!record) {
        await slackNotification(
            "Lead Gen",
            `*Base ID:* ${baseID}\n*Record ID:* ${record.id}\n*Error:* Error retrieving record`,
            "#error-alerts"
        );

        throw new Error("No record found");
    }

    // if ("Text" in record) {
    //     const status =
    //         record.Status === "In Progress"
    //             ? "Record is currently being processed."
    //             : "Record was already parsed.";

    //     throw new Error(status);
    // }

    if (!("Data" in record)) {
        await slackNotification(
            "Lead Gen",
            `*Base ID:* ${baseID}\n*Record ID:* ${record.id}\n*Error:* Upload file to parse`,
            "#error-alerts"
        );

        throw new Error("No file to parse");
    }

    if (!("Text" in record)) {
        await Airtable.updateRecord(baseID, "Data", record.id, {
            Text: "In Progress",
        });
    }
    if (!("Email" in record) && record.Source.includes("ZoomInfo")) {
        await Airtable.updateRecord(baseID, "Data", record.id, {
            Email: "In Progress",
        });
    }

    const runValidator = !("Text" in record) || !("Email" in record);

    if (!runValidator) {
        await slackNotification(
            "Lead Gen",
            `*Base ID:* ${baseID}\n*Record ID:* ${record.id}\n*Error:* Run validator is false`,
            "#error-alerts"
        );

        throw new Error("Text or Email in record");
    }

    let tag = "";

    if ("Tag" in record) {
        tag = record.Tag;
    }

    let prospects;
    if (record.Source === "ZoomInfo Export") {
        prospects = record.Data[0].url;
    } else {
        prospects = await _.readFiles(record);
    }

    if (record.Source === "Reonomy") {
        prospects = await parseReonomy(prospects, tag);
    }
    if (record.Source === "Reonomy Export") {
        const { data } = await axios.get(record.Data[0].url);

        prospects = await csvToJson().fromString(data);

        prospects = await parseReonomyExport(prospects, tag);
    }
    if (record.Source === "ZoomInfo") {
        prospects = await parseZoominfo(prospects, tag);
    }
    if (record.Source === "ZoomInfo Export") {
        prospects = await parseZoominfoExport(prospects, tag);
    }

    if (prospects) {
        let { mobileContacts, emailContacts, landlineContacts = [] } = prospects;

        if (!("Email" in record)) {
            const res = await emailHandler(emailContacts, baseID, record);

            if (!res.success) {
                await slackNotification(
                    "Email Handler",
                    `*Base ID:* ${baseID}\n*Record ID:* ${record.id}\n*Error:* ${res.message}`,
                    "#error-alerts"
                );

                // await writeCsv(emailContacts, "prop managers");
            }
        }

        if (!("Text" in record)) {
            const textHandlerRes = await textHandler(mobileContacts, baseID, record);

            if (!textHandlerRes.success) {
                await slackNotification(
                    "Text Handler",
                    `*Base ID:* ${baseID}\n*Record ID:* ${record.id}\n*Error:* ${res.message}`,
                    "#error-alerts"
                );
            }

            // if (landlineContacts) {
            //     const callHandlerRes = await callHandler(landlineContacts, baseID, record);

            //     if (!callHandlerRes.success) {
            //         await slackNotification(
            //             "Call Handler",
            //             `*Base ID:* ${baseID}\n*Record ID:* ${record.id}\n*Error:* ${res.message}`,
            //             "#error-alerts"
            //         );
            //     }
            // }
        }
    }
};

module.exports = { parse };
