require("dotenv").config();

const Airtable = require("../src/Airtable");
const Neverbounce = require("../src/Neverbounce");

const BASE_ID = "appQnw7GBSDCatAzf";
const CONTACTS_TABLE = "Contacts";
const JOBS_TABLE = "Email Validation Jobs";

const LIMIT = 500;

const buildFilterFormula = () => {
    const statusClause = '{Status} = "New (Needs Validation)"';
    const emailValidationBlank = 'OR({Email Validation} = "", {Email Validation} = BLANK())';
    return `AND(${statusClause}, ${emailValidationBlank})`;
};

const fetchContactsNeedingValidation = async () => {
    const filterByFormula = buildFilterFormula();
    const records = await Airtable.fetchFilteredRecords({
        baseID: BASE_ID,
        table: CONTACTS_TABLE,
        filterByFormula,
    });
    if (!records || !records.length) return [];

    const formatted = records
        .filter((r) => r.Email)
        .map((r) => ({ id: r.recordID, email: String(r.Email).trim() }));

    return formatted.slice(0, LIMIT);
};

const createNeverbounceJob = async (emails) => {
    const date = new Date().toISOString().split("T")[0];
    const filename = `${date}_${emails.length}_contacts.csv`;
    const res = await Neverbounce.createJob(emails, {
        filename,
        auto_parse: true,
        auto_start: true,
    });
    if (!res.success) {
        throw new Error(`NeverBounce job creation failed: ${JSON.stringify(res.error)}`);
    }

    const jobId = res.data?.job_id || res.data?.id || res.data?.job?.id;
    if (!jobId) {
        throw new Error(
            `Unable to determine NeverBounce job id from response: ${JSON.stringify(res.data)}`
        );
    }

    return jobId;
};

const insertJobRecord = async (jobId, jobName) => {
    const record = { job_id: jobId, Status: "Running", "Job Name": jobName };
    const created = await Airtable.createRecord(BASE_ID, JOBS_TABLE, record);
    if (!created) {
        throw new Error("Failed to insert Email Validation Jobs record in Airtable");
    }
    return created;
};

const updateContactsStatus = async (contactIds) => {
    const batchSize = 10;
    const totalBatches = Math.ceil(contactIds.length / batchSize);

    console.log(`Updating ${contactIds.length} contacts in ${totalBatches} batches...`);

    for (let i = 0; i < totalBatches; i++) {
        const batch = contactIds.slice(i * batchSize, (i + 1) * batchSize);
        const records = batch.map((id) => ({
            id,
            fields: {
                Status: "Validating Email...",
            },
        }));

        const updated = await Airtable.updateRecords(BASE_ID, CONTACTS_TABLE, records);
        if (!updated) {
            console.warn(`Failed to update batch ${i + 1} of ${totalBatches}`);
        } else {
            console.log(`Updated batch ${i + 1}/${totalBatches}`);
        }
    }

    console.log("All contacts updated to 'Validating Email...'");
};

(async () => {
    try {
        try {
            console.log("Fetching up to", LIMIT, "contacts needing validation...");
            const emails = await fetchContactsNeedingValidation();

            console.log("Found", emails.length, "contacts");
            if (emails.length === 0) {
                console.log("No contacts matched the criteria.");
                return;
            }

            console.log("Creating NeverBounce job...");
            const jobId = await createNeverbounceJob(emails);
            console.log("NeverBounce job created:", jobId);

            const date = new Date().toISOString().split("T")[0];
            const jobName = `${date}_${emails.length}_contacts.csv`;

            console.log("Recording job in Airtable...");
            await insertJobRecord(jobId, jobName);
            console.log("Job recorded in Airtable with Status=Running");

            console.log("Updating contact statuses...");
            const contactIds = emails.map((e) => e.id);
            await updateContactsStatus(contactIds);
            console.log("Done!");
        } catch (error) {
            console.error("validate-emails failed:", error.message);
            process.exitCode = 1;
        }
    } catch (error) {
        console.error(error);
    }
})();
