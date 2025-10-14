require("dotenv").config();
const axios = require("axios");
const Agents = require("./Agent");

class Instantly {
    filterValidEmails = (results) => {
        return results
            .filter((email) => email.verification.result === "valid")
            .map((item) => item.data)
            .map((contact) => {
                let email = contact.email;
                delete contact.email;
                return {
                    ...contact,
                    Email: email,
                };
            });
    };

    // Bulk add leads to an Instantly campaign
    // params: { contacts: Array<InstantlyLead>, campaignId: string }
    bulkAddLeadsToCampaign = async ({ contacts, campaignId }) => {
        try {
            if (!process.env.INSTANTLY_API_KEY) {
                throw new Error("Missing INSTANTLY_API_KEY env var");
            }
            if (!campaignId) {
                throw new Error("bulkAddLeadsToCampaign requires campaignId");
            }
            if (!Array.isArray(contacts) || contacts.length === 0) {
                return { success: true, added: 0, responses: [] };
            }
            // Expect contacts to already be in Instantly lead format
            const leads = contacts.filter((l) => l && l.email);

            const MAX_PER_REQUEST = 1000; // Instantly API limit
            const responses = [];

            for (let i = 0; i < leads.length; i += MAX_PER_REQUEST) {
                const chunk = leads.slice(i, i + MAX_PER_REQUEST);

                const { data } = await axios.post(
                    "https://api.instantly.ai/api/v2/leads/add",
                    { campaign_id: campaignId, leads: chunk },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${process.env.INSTANTLY_API_KEY}`,
                        },
                    }
                );

                responses.push(data);

                // Throttle to respect Instantly rate limits (<=100 req / 10s)
                await new Promise((r) => setTimeout(r, 200));
            }

            return { success: true, added: leads.length, responses };
        } catch (error) {
            console.error(
                "Instantly.bulkAddLeadsToCampaign() -->",
                error.response?.data || error.message
            );
            return { success: false, error: error.response?.data || error.message };
        }
    };

    // Analyze an Instantly conversation to classify intent and follow-up
    // params: { messages?: Array<{ from: 'prospect'|'agent'|'system'|'unknown', text: string, date?: string }>, raw?: string }
    analyzeConversation = async ({ messages, raw }) => {
        try {
            // Build a simple text transcript for the agent if messages are provided
            let conversation = "";
            if (Array.isArray(messages) && messages.length > 0) {
                conversation = messages
                    .map((m) => {
                        const role = m && m.from ? m.from : "unknown";
                        const ts = m && m.date ? ` [${m.date}]` : "";
                        const body = m && m.text ? m.text : "";
                        return `${role}${ts}: ${body}`;
                    })
                    .join("\n\n");
            } else if (typeof raw === "string" && raw.trim().length > 0) {
                conversation = raw;
            }

            if (!conversation) {
                return { success: false, message: "Missing conversation content" };
            }

            const result = await Agents.classifyInstantlyConversation({ conversation });
            return result; // { success, data: { status, followUpDate } }
        } catch (error) {
            console.error("Instantly.analyzeConversation() -->", error);
            return { success: false, message: error.message || "Failed to analyze conversation" };
        }
    };
}

module.exports = new Instantly();
