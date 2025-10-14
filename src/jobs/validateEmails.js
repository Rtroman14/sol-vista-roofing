require("dotenv").config();

const Airtable = require("../Airtable");
const Neverbounce = require("../NeverBounce");

const CONTACTS_TABLE = "Contacts";
const JOBS_TABLE = "Email Validation Jobs";

// Build Airtable filter for contacts needing validation
const buildFilterFormula = () => {
    const statusClause = '{Status} = "New (Needs Validation)"';
    const emailValidationBlank = 'OR({Email Validation} = "", {Email Validation} = BLANK())';
    return `AND(${statusClause}, ${emailValidationBlank})`;
};

const fetchContactsNeedingValidation = async (baseId) => {
    const filterByFormula = buildFilterFormula();
    const records = await Airtable.fetchFilteredRecords({
        baseID: baseId,
        table: CONTACTS_TABLE,
        filterByFormula,
    });
    if (!records || !records.length) return [];

    return records
        .filter((r) => r.Email)
        .map((r) => ({ id: r.recordID, email: String(r.Email).trim() }));
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

    return { jobId, filename };
};

const insertJobRecord = async (baseId, jobId, jobName) => {
    const record = { job_id: jobId, Status: "Running", "Job Name": jobName };
    const created = await Airtable.createRecord(baseId, JOBS_TABLE, record);
    if (!created) {
        throw new Error("Failed to insert Email Validation Jobs record in Airtable");
    }
    return created;
};

const updateContactsStatus = async (baseId, contactIds) => {
    const batchSize = 10;
    const totalBatches = Math.ceil(contactIds.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
        const batch = contactIds.slice(i * batchSize, (i + 1) * batchSize);
        const records = batch.map((id) => ({
            id,
            fields: { Status: "Validating Email..." },
        }));

        await Airtable.updateRecords(baseId, CONTACTS_TABLE, records);
    }
};

const runValidateEmails = async ({ baseId }) => {
    try {
        const emails = await fetchContactsNeedingValidation(baseId);

        if (!emails.length) {
            return { success: true, message: "No contacts matched the criteria." };
        }

        const { jobId, filename } = await createNeverbounceJob(emails);

        await insertJobRecord(baseId, jobId, filename);

        const contactIds = emails.map((e) => e.id);
        await updateContactsStatus(baseId, contactIds);

        const message = `Created NeverBounce job ${jobId}; queued ${emails.length} contacts`;
        return { success: true, message, jobId, queued: emails.length };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

module.exports = { runValidateEmails };
