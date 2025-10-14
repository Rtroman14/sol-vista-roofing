const express = require("express");
const router = express.Router();

const Airtable = require("../src/Airtable");
const NeverBounce = require("../src/NeverBounce");
const _ = require("../src/Helpers");
const slackNotification = require("../src/slackNotification");
const { runValidateEmails } = require("../src/jobs/validateEmails");
const { runUploadContactsToInstantly } = require("../src/jobs/uploadContactsToInstantly");

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

// Airtable Actions: Run an action against the base
router.post("/actions/run", async (req, res) => {
    try {
        const body = req.body || {};
        const baseId = body.baseId || body.baseID;
        const tableName = body.tableName || "Actions";
        const recordId = body.recordId || body.recordID;

        if (!baseId || !tableName || !recordId) {
            return res.status(400).json({ error: "Missing baseId/tableName/recordId" });
        }

        const actionRecord = await Airtable.getRecord(baseId, tableName, recordId);
        if (!actionRecord) return res.status(404).json({ error: "Action record not found" });

        const actionType = actionRecord["Action Type"];
        if (!actionType) return res.status(400).json({ error: "Missing Action Type" });

        // If already running, return early and update message
        if (actionRecord.Status === "Running") {
            const msg = "This action can't run while status is already running.";
            await Airtable.updateRecord(baseId, tableName, recordId, { Message: msg });
            return res.status(409).json({ error: msg });
        }

        // mark as running for UX
        await Airtable.updateRecord(baseId, tableName, recordId, {
            Status: "Running",
            Message: `Starting ${actionType}...`,
        });

        // Respond immediately to avoid Airtable 30s timeout
        res.status(202).json({ ok: true, message: `Queued ${actionType}` });

        // Continue processing in background
        setImmediate(async () => {
            try {
                let result;
                if (actionType === "Validate Emails") {
                    result = await runValidateEmails({ baseId });
                } else if (actionType === "Upload Contacts to Instantly") {
                    result = await runUploadContactsToInstantly({ baseId });
                } else {
                    throw new Error(`Unsupported Action Type: ${actionType}`);
                }

                const message = (result && result.message) || `${actionType} completed`;
                await Airtable.updateRecord(baseId, tableName, recordId, {
                    Status: null,
                    Message: message,
                });
            } catch (err) {
                const msg = err && err.message ? err.message : "Unknown error";
                await Airtable.updateRecord(baseId, tableName, recordId, {
                    Status: "Error",
                    Message: msg,
                });
            }
        });
    } catch (error) {
        return res.status(500).json({ error: error.message || "Server error" });
    }
});

module.exports = router;
