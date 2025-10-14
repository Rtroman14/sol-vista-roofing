const Airtable = require("../../Airtable");
const _ = require("../../Helpers");
const slackNotification = require("../../slackNotification");

module.exports = async (mobileContacts, baseID, record) => {
    try {
        console.log("Mobile contacts:", mobileContacts.length);

        // filter current reonomy contacts against contacts in view: "Texted"
        let airtableContacts = await Airtable.getFilteredRecords(baseID, {
            field: "Outreach",
            value: "Text",
        });

        // Farha
        if (baseID === "appsbsb16Jc3AP0wx") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["app3yxqMbRKS90o3E", "appAJd8DNpOfsXN53", "appgBfwDMQ3Bwf5WA"],
                "Text"
            );
            airtableContacts = [...airtableContacts, ...archivedContacts];
        }
        // Roper
        if (baseID === "appr7rcKd3W6oMdiC") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["appeGXwk0TSkWK325"],
                "Text"
            );
            airtableContacts = [...airtableContacts, ...archivedContacts];
        }
        // Eco Tec
        if (baseID === "appoNqmB15dMPPEXD") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["appUzWnleU21USqls"],
                "Text"
            );
            airtableContacts = [...airtableContacts, ...archivedContacts];
        }
        // Integrity
        if (baseID === "appGjj2kN0ccJeeua") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["appLVlpoe7RYAQfm9"],
                "Text"
            );
            airtableContacts = [...airtableContacts, ...archivedContacts];
        }
        // Augustine
        if (baseID === "applMh4PTJl6JI8yS") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["appD7l9TtENl5o66u"],
                "Text"
            );
            airtableContacts = [...airtableContacts, ...archivedContacts];
        }

        // DND list
        const dndList = await Airtable.getRecordsByView("appGB7S9Wknu6MiQb", "DND", "All");
        airtableContacts = [...airtableContacts, ...dndList];

        if (airtableContacts) {
            mobileContacts = mobileContacts.map((contact) => ({
                ...contact,
                "Phone Number": contact["Phone Number"]?.replace(/\D/g, ""),
            }));
            airtableContacts = airtableContacts.map((contact) => ({
                ...contact,
                "Phone Number": contact["Phone Number"]?.replace(/\D/g, ""),
            }));

            mobileContacts = _.arrayDifference(mobileContacts, airtableContacts, "Phone Number");
        }

        console.log("Mobile contacts after Airtable filter:", mobileContacts.length);

        // * scrub against black alliance
        const scrubbedMobileContacts = await _.scrubAllMobileContacts(mobileContacts);
        if (!scrubbedMobileContacts.success) {
            await slackNotification("Text Parser", scrubbedMobileContacts.error, "#error-alerts");
        }

        console.log("Mobile contacts after Blacklist Alliance filter:", mobileContacts.length);

        mobileContacts = _.formatAirtableContacts(scrubbedMobileContacts.data);

        console.log("Uploading prospects...");

        const uploadedMobileContacts = await Airtable.batchUpload(mobileContacts, baseID);

        if (uploadedMobileContacts) {
            await Airtable.updateRecord(baseID, "Data", record.id, {
                Text: "Uploaded",
            });
            console.log("Successfully uploaded Text prospects");

            return {
                success: true,
                message: "Successfully uploaded Text prospects",
            };
        } else {
            await Airtable.updateRecord(baseID, "Data", record.id, {
                Text: "Error",
            });
            console.log("ERROR uploading Text prospects");

            return {
                success: false,
                message: "ERROR uploading Text prospects.",
            };
        }
    } catch (error) {
        console.log(`ERROR - textHandler() ---${error}`);

        return {
            success: false,
            message: error.message,
        };
    }
};
