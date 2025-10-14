const Airtable = require("../../Airtable");
const _ = require("../../Helpers");
const slackNotification = require("../../slackNotification");

module.exports = async (landlineContacts, baseID, record) => {
    try {
        console.log("Call contacts:", landlineContacts.length);

        // filter current reonomy contacts against contacts in view: "Texted"
        let airtableContactsText = await Airtable.getFilteredRecords(baseID, {
            field: "Outreach",
            value: "Text",
        });
        let airtableContactsCall = await Airtable.getFilteredRecords(baseID, {
            field: "Outreach",
            value: "Call",
        });

        // Farha
        if (baseID === "appsbsb16Jc3AP0wx") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["app3yxqMbRKS90o3E", "appAJd8DNpOfsXN53", "appgBfwDMQ3Bwf5WA"],
                "Text"
            );
            airtableContactsText = [...airtableContactsText, ...archivedContacts];
        }
        // Roper
        if (baseID === "appr7rcKd3W6oMdiC") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["appeGXwk0TSkWK325"],
                "Text"
            );
            airtableContactsText = [...airtableContactsText, ...archivedContacts];
        }
        // Eco Tec
        if (baseID === "appoNqmB15dMPPEXD") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["appUzWnleU21USqls"],
                "Text"
            );
            airtableContactsText = [...airtableContactsText, ...archivedContacts];
        }
        // Integrity
        if (baseID === "appGjj2kN0ccJeeua") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["appLVlpoe7RYAQfm9"],
                "Text"
            );
            airtableContactsText = [...airtableContactsText, ...archivedContacts];
        }
        // Augustine
        if (baseID === "applMh4PTJl6JI8yS") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["appD7l9TtENl5o66u"],
                "Text"
            );
            airtableContactsText = [...airtableContactsText, ...archivedContacts];
        }

        // DND list
        const dndList = await Airtable.getRecordsByView("appGB7S9Wknu6MiQb", "DND", "All");
        let allAirtableContacts = [...airtableContactsText, ...airtableContactsCall, ...dndList];

        if (allAirtableContacts) {
            landlineContacts = landlineContacts.map((contact) => ({
                ...contact,
                "Phone Number": contact["Phone Number"]?.replace(/\D/g, ""),
            }));
            allAirtableContacts = allAirtableContacts.map((contact) => ({
                ...contact,
                "Phone Number": contact["Phone Number"]?.replace(/\D/g, ""),
            }));

            landlineContacts = _.arrayDifference(
                landlineContacts,
                allAirtableContacts,
                "Phone Number"
            );
        }

        console.log("Call contacts after Airtable filter:", landlineContacts.length);

        // * scrub against black alliance
        const scrubbedContacts = await _.scrubAllMobileContacts(landlineContacts);
        if (!scrubbedContacts.success) {
            await slackNotification("Text Parser", scrubbedContacts.error, "#error-alerts");
        }

        console.log("Call contacts after Blacklist Alliance filter:", landlineContacts.length);

        landlineContacts = _.formatAirtableContacts(scrubbedContacts.data);

        console.log("Uploading prospects...");

        const uploadedCallContacts = await Airtable.batchUpload(landlineContacts, baseID);

        if (uploadedCallContacts) {
            await Airtable.updateRecord(baseID, "Data", record.id, {
                Text: "Uploaded",
            });
            console.log("Successfully uploaded Call prospects");

            return {
                success: true,
                message: "Successfully uploaded Call prospects",
            };
        } else {
            await Airtable.updateRecord(baseID, "Data", record.id, {
                Text: "Error",
            });
            console.log("ERROR uploading Call prospects");

            return {
                success: false,
                message: "ERROR uploading Call prospects.",
            };
        }
    } catch (error) {
        console.log(`ERROR - callHandler() ---${error}`);

        return {
            success: false,
            message: error.message,
        };
    }
};
