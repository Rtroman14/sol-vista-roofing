const express = require("express");
const router = express.Router();

// NOTE: Keep this minimal boilerplate. You'll fill in the logic later.
// Expected Instantly event payload includes fields like:
// { event_type: 'email_sent' | 'email_bounced' | 'reply_received', ... }

router.post("/webhook", async (req, res) => {
    try {
        const event = req.body || {};
        const type = event.event_type;

        if (!type) {
            return res.status(400).json({ ok: false, error: "Missing event_type" });
        }

        // Basic validation for known events
        const allowed = new Set(["email_sent", "email_bounced", "reply_received"]);
        if (!allowed.has(type)) {
            // Accept unknowns but no-op; useful for future events without failing retries
            return res.status(202).json({ ok: true, received: true, ignored: true });
        }

        // Boilerplate routing by event type. Fill in per-event logic later.
        switch (type) {
            case "email_sent": {
                // TODO: handle email_sent
                break;
            }
            case "email_bounced": {
                // TODO: handle email_bounced
                break;
            }
            case "reply_received": {
                // TODO: handle reply_received
                // Example: event.is_first, event.reply_text_snippet, event.lead_email, etc.
                break;
            }
            default: {
                // Should not reach due to allowed set, but keep safe guard
                break;
            }
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error("Instantly webhook error -->", error);
        return res.status(500).json({ ok: false });
    }
});

module.exports = router;
