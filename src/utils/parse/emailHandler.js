const Airtable = require("../../Airtable");
const NeverBounce = require("../../NeverBounce");
const _ = require("../../Helpers");

module.exports = async (emailContacts, baseID, record) => {
    try {
        if (record.Source.includes("Reonomy")) {
            return {
                success: true,
                message: "Skipped uploading emails because source is Reonomy",
            };
        }

        console.log("Email contacts:", emailContacts.length);

        const title = `${baseID} - ${record.Location}`;

        // filter current reonomy contacts against contacts in view: "Texted"
        let airtableContacts = await Airtable.getFilteredRecords(baseID, {
            field: "Outreach",
            value: "Email",
        });

        // Farha
        if (baseID === "appsbsb16Jc3AP0wx") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["app3yxqMbRKS90o3E", "appAJd8DNpOfsXN53", "appgBfwDMQ3Bwf5WA"],
                "Email"
            );
            airtableContacts = [...airtableContacts, ...archivedContacts];
        }
        // Roper
        if (baseID === "appr7rcKd3W6oMdiC") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["appeGXwk0TSkWK325"],
                "Email"
            );
            airtableContacts = [...airtableContacts, ...archivedContacts];
        }
        // Eco Tec
        if (baseID === "appoNqmB15dMPPEXD") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["appUzWnleU21USqls"],
                "Email"
            );
            airtableContacts = [...airtableContacts, ...archivedContacts];
        }
        // Integrity
        if (baseID === "appGjj2kN0ccJeeua") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["appLVlpoe7RYAQfm9"],
                "Email"
            );
            airtableContacts = [...airtableContacts, ...archivedContacts];
        }
        // Augustine
        if (baseID === "applMh4PTJl6JI8yS") {
            const archivedContacts = await Airtable.fetchArchiveBases(
                ["appD7l9TtENl5o66u"],
                "Email"
            );
            airtableContacts = [...airtableContacts, ...archivedContacts];
        }

        if (airtableContacts) {
            emailContacts = _.arrayDifference(emailContacts, airtableContacts, "Email");
        }

        console.log("Email contacts after filter:", emailContacts.length);

        const createdJob = await NeverBounce.createJob(emailContacts, title);

        if (createdJob) {
            await Airtable.updateRecord(baseID, "Data", record.id, {
                "Neverbounce Job": createdJob.job_id,
                Email: "In Neverbounce",
            });
            console.log("Uploaded prospects to Neverbounce:", createdJob.job_id);
        } else {
            await Airtable.updateRecord(baseID, "Data", record.id, { Email: "Error" });
            console.log("ERROR uploading prospects to Neverbounce");

            return {
                success: false,
                message: "Job was not uploaded to Neverbounce.",
            };
        }

        return {
            success: true,
            message: `Uploaded prospects to Neverbounce: ${createdJob.job_id}`,
        };
    } catch (error) {
        console.log(`ERROR - emailHandler() ---${error}`);

        return {
            success: false,
            message: error.message,
        };
    }
};
