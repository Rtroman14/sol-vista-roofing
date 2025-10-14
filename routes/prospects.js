const express = require("express");
const router = express.Router();

const Airtable = require("../src/Airtable");
const NeverBounce = require("../src/NeverBounce");
const _ = require("../src/Helpers");
const slackNotification = require("../src/slackNotification");

const { parse } = require("../controllers/parseProspects");
const { setDND } = require("../controllers/prospects");

router.post("/parse", async (req, res) => {
    const { baseID, recordID } = req.body;

    const record = await Airtable.getRecord(baseID, "Data", recordID);

    res.send(record);

    parse(record, baseID);
});

router.post("/emails/neverbounce/upload", async (req, res) => {
    const { baseID, recordID } = req.body;

    const record = await Airtable.getRecord(baseID, "Data", recordID);

    const jobID = record["Neverbounce Job"];

    const data = await NeverBounce.jobResults(jobID);

    let emailProspects = _.formatAirtableContacts(data);

    const uploadedEmailContacts = await Airtable.batchUpload(emailProspects, baseID);

    if (!uploadedEmailContacts) {
        await slackNotification(
            "Email Uploader",
            `*Base ID:* ${baseID}\n*Record ID:* ${record.id}\n*Error:* Error when attempting to upload email prospects.`,
            "#error-alerts"
        );
    }

    const result = uploadedEmailContacts ? "Uploaded" : "Error";

    const updatedRecord = await Airtable.updateRecord(baseID, "Data", record.id, { Email: result });

    res.json(updatedRecord);
});

router.post("/dnd", setDND);

module.exports = router;
