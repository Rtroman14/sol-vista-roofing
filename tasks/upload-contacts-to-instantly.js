require("dotenv").config();

const Airtable = require("../src/Airtable");
const Instantly = require("../src/Instantly");

const BASE_ID = "appQnw7GBSDCatAzf";
const CONTACTS_TABLE = "Contacts";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Convert Airtable contacts to Instantly lead payloads
const formatLeadsForInstantly = (contacts) => {
    const firstString = (val) => {
        if (Array.isArray(val)) return String(val[0] ?? "").trim();
        return val === undefined || val === null ? "" : String(val).trim();
    };
    const sanitize = (obj) => {
        const cleaned = { ...obj };
        Object.keys(cleaned).forEach((k) => {
            if (cleaned[k] === undefined || cleaned[k] === null || cleaned[k] === "") {
                delete cleaned[k];
            }
        });
        return cleaned;
    };

    return contacts
        .map((c) => {
            const lead = sanitize({
                email: c.Email ? String(c.Email).trim() : null,
                first_name: c["First Name"],
                last_name: c["Last Name"],
                company_name: c["Company Name"],
                phone: c["Phone Number"],
            });

            const customVariables = sanitize({
                is_signatory: c["Is Signatory"],
                street: firstString(c["Primary Street"]),
                city: firstString(c["Primary city"]),
                properties_count: c["Properties Count"],
                title: c.Title,
                total_building_area: c["Total Building Area"],
            });

            if (Object.keys(customVariables).length) {
                lead.custom_variables = customVariables;
            }

            return lead;
        })
        .filter((l) => !!l.email);
};

const buildFilterFormula = () => {
    const statusClause = '{Status} = "Email Validated"';
    const validationClause = '{Email Validation} = "valid"';
    const nonEmpty = (field) => `AND({${field}} != "", {${field}} != BLANK())`;
    const responseDateEmpty = 'OR({Response Date} = "", {Response Date} = BLANK())';
    return `AND(${statusClause}, ${validationClause}, ${nonEmpty("Email")}, ${nonEmpty(
        "Primary Street"
    )}, ${nonEmpty("Primary City")}, ${nonEmpty("campaign_id")}, ${responseDateEmpty})`;
};

const fetchEligibleContacts = async () => {
    const filterByFormula = buildFilterFormula();
    const records = await Airtable.fetchFilteredRecords({
        baseID: BASE_ID,
        table: CONTACTS_TABLE,
        filterByFormula,
    });
    return (records || []).filter((r) => r.Email);
};

const groupByCampaign = (contacts) => {
    const firstString = (val) => {
        if (Array.isArray(val)) return String(val[0] ?? "").trim();
        return val === undefined || val === null ? "" : String(val).trim();
    };
    return contacts.reduce((acc, c) => {
        const campaignId = firstString(c.campaign_id);
        if (!campaignId) return acc;
        if (!acc[campaignId]) acc[campaignId] = [];
        acc[campaignId].push(c);
        return acc;
    }, {});
};

const updateContactsStatus = async (contacts, status) => {
    const ids = contacts.map((c) => c.recordID);
    const batchSize = 10; // Airtable update limit per request

    for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const records = batchIds.map((id) => ({ id, fields: { Status: status } }));
        await Airtable.updateRecords(BASE_ID, CONTACTS_TABLE, records);
        // Throttle to ~4 requests/sec to respect Airtable 5 rps limit
        await sleep(250);
    }
};

(async () => {
    try {
        console.log("Fetching eligible contacts from Airtable...");
        const contacts = await fetchEligibleContacts();
        console.log(`Found ${contacts.length} eligible contacts`);
        if (!contacts.length) return;

        const byCampaign = groupByCampaign(contacts);
        const campaignIds = Object.keys(byCampaign);
        console.log(`Grouped into ${campaignIds.length} campaign(s)`);

        for (const campaignId of campaignIds) {
            const group = byCampaign[campaignId];
            console.log(
                `Uploading ${group.length} contact(s) to Instantly campaign ${campaignId}...`
            );

            const leads = formatLeadsForInstantly(group);

            const res = await Instantly.bulkAddLeadsToCampaign({
                contacts: leads,
                campaignId,
            });

            if (!res.success) {
                console.error(`Failed to upload to campaign ${campaignId}:`, res.error || res);
                continue;
            }

            console.log(
                `Uploaded ${res.added} contact(s) to campaign ${campaignId}. Updating Airtable statuses...`
            );

            await updateContactsStatus(group, "Uploaded to Instantly");

            // Small pause between campaigns to be friendly to both APIs
            await sleep(500);
        }

        console.log("All done.");
    } catch (error) {
        console.error("upload-contacts-to-instantly failed:", error.message);
        process.exitCode = 1;
    }
})();
