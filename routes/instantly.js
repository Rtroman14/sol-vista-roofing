const express = require("express");
const router = express.Router();

const Airtable = require("../src/Airtable");
const _ = require("../src/Helpers");
const Agent = require("../src/Agent");
const slackNotification = require("../src/slackNotification");
const { format } = require("date-fns");

router.post("/webhook", async (req, res) => {
    const BASE_ID = "appQnw7GBSDCatAzf";
    const TABLE = "Contacts";

    try {
        const event = req.body || {};
        const type = event.event_type;

        if (!type) return res.status(400).json({ ok: false, error: "Missing event_type" });

        const allowed = new Set(["email_sent", "email_bounced", "reply_received"]);
        if (!allowed.has(type)) {
            return res.status(202).json({ ok: true, received: true, ignored: true });
        }

        const eventTimestamp = event.timestamp ? new Date(event.timestamp) : new Date();
        const today = format(eventTimestamp, "yyyy-MM-dd");
        const timestamp = format(eventTimestamp, "yyyy-MM-dd HH:mm:ss");

        const findProspectByEmail = async (email) => {
            try {
                const results = await Airtable.fetchFilteredRecords({
                    baseID: BASE_ID,
                    table: TABLE,
                    filterByFormula: `{Email} = "${email}"`,
                });
                return Array.isArray(results) && results.length ? results[0] : null;
            } catch (e) {
                return null;
            }
        };

        const prospect = await findProspectByEmail(event.email);
        if (!prospect) {
            return res
                .status(202)
                .json({ ok: true, received: true, ignored: "no matching prospect" });
        }

        if (type === "email_sent") {
            let conversation;

            const emailBody = _.htmlToText(event.email_html || "");

            if (event.is_first === true) {
                conversation = `Subject: ${event.email_subject || ""}\n\n${emailBody}`.trim();
            } else {
                // Append to existing conversation for follow-up emails
                const existing = prospect["Conversation"] || "";

                conversation = existing ? `${existing}\n\n---\n\n${emailBody}` : emailBody;
            }

            const updates = {
                Status: "Email Sent",
                Conversation: conversation,
            };

            if (typeof event.step === "number") {
                updates["Emails Sent"] = event.step;
            }
            if (event.is_first === true) {
                updates["First Email Sent"] = timestamp;
            }

            await Airtable.updateRecord(BASE_ID, "Contacts", prospect.recordID, updates);

            return res.status(200).json({ ok: true });
        }

        if (type === "reply_received") {
            const replyText = _.htmlToText(event.reply_html);
            const existing = prospect["Conversation"] || "";
            const conversation = existing ? `${existing}\n\n---\n\n${replyText}` : replyText;

            let status = prospect.Status || null;
            let followUpDate = null;

            const classified = await Agent.classifyInstantlyConversation({ conversation });
            if (classified && classified.success && classified.data) {
                status = classified.data.status;
                followUpDate = classified.data.followUpDate;
            }

            const updates = {
                "Unibox URL": event.unibox_url || null,
                Conversation: conversation,
                Status: status,
                "Follow-up Date": followUpDate,
            };

            if (!prospect["Response Date"]) {
                updates["Response Date"] = timestamp;
            }

            await Airtable.updateRecord(BASE_ID, TABLE, prospect.recordID, updates);

            return res.status(200).json({ ok: true });
        }

        // email_bounced or other allowed-but-unhandled events: no-op success
        return res.status(200).json({ ok: true, received: true });
    } catch (error) {
        console.error("Instantly webhook error -->", error);

        await slackNotification({
            username: "Sol Vista - Instantly Webhook",
            text: `Error processing Instantly webhook: ${error.message || "Unknown error"}`,
            channel: "#errors",
        });

        return res.status(500).json({ ok: false });
    }
});

module.exports = router;
