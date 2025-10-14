require("dotenv").config();

const Airtable = require("../src/Airtable");
const Neverbounce = require("../src/Neverbounce");

const BASE_ID = "appQnw7GBSDCatAzf";
const CONTACTS_TABLE = "Contacts";
const JOBS_TABLE = "Email Validation Jobs";

const fetchRunningJobs = async () => {
    const filterByFormula = '{Status} = "Running"';
    const records = await Airtable.fetchFilteredRecords({
        baseID: BASE_ID,
        table: JOBS_TABLE,
        filterByFormula,
    });

    if (!records || !records.length) return [];

    return records.map((r) => ({
        recordID: r.recordID,
        jobId: r.job_id,
        jobName: r["Job Name"],
    }));
};

const processJobResults = async (job) => {
    console.log(`Processing job ${job.jobId} (${job.jobName})...`);

    const res = await Neverbounce.getJobResults(job.jobId);
    if (!res.success) {
        console.error(`Failed to fetch results for job ${job.jobId}:`, res.error);
        return { success: false };
    }

    const results = res.data?.results || [];
    if (!results.length) {
        console.log(`No results found for job ${job.jobId}`);
        return { success: true, processed: 0 };
    }

    console.log(`Found ${results.length} results for job ${job.jobId}`);

    const counts = {
        valids: 0,
        invalids: 0,
        disposables: 0,
        catchalls: 0,
        unknowns: 0,
    };

    const contactUpdates = results
        .filter((result) => result.data?.id)
        .map((result) => {
            const validationResult = result.verification?.result || "unknown";

            if (validationResult === "valid") counts.valids++;
            else if (validationResult === "invalid") counts.invalids++;
            else if (validationResult === "disposable") counts.disposables++;
            else if (validationResult === "catchall") counts.catchalls++;
            else counts.unknowns++;

            return {
                id: result.data.id,
                fields: {
                    "Email Validation": validationResult,
                    Status: "Email Validated",
                },
            };
        });

    if (!contactUpdates.length) {
        console.log(`No contacts to update for job ${job.jobId}`);
        return { success: true, processed: 0 };
    }

    console.log(
        `Validation results - Valid: ${counts.valids}, Invalid: ${counts.invalids}, Disposable: ${counts.disposables}, Catchall: ${counts.catchalls}, Unknown: ${counts.unknowns}`
    );

    const batchSize = 10;
    const totalBatches = Math.ceil(contactUpdates.length / batchSize);

    console.log(`Updating ${contactUpdates.length} contacts in ${totalBatches} batches...`);

    for (let i = 0; i < totalBatches; i++) {
        const batch = contactUpdates.slice(i * batchSize, (i + 1) * batchSize);

        const updated = await Airtable.updateRecords(BASE_ID, CONTACTS_TABLE, batch);
        if (!updated) {
            console.warn(`Failed to update batch ${i + 1} of ${totalBatches}`);
        } else {
            console.log(`Updated batch ${i + 1}/${totalBatches}`);
        }
    }

    await Airtable.updateRecord(BASE_ID, JOBS_TABLE, job.recordID, {
        Status: "Completed",
        valids: counts.valids,
        invalids: counts.invalids,
        disposables: counts.disposables,
        catchalls: counts.catchalls,
        unknowns: counts.unknowns,
    });

    console.log(`Job ${job.jobId} marked as Completed with result counts`);

    return { success: true, processed: contactUpdates.length };
};

(async () => {
    try {
        console.log("Fetching running jobs...");
        const runningJobs = await fetchRunningJobs();

        console.log(`Found ${runningJobs.length} running jobs`);
        if (runningJobs.length === 0) {
            console.log("No running jobs to process.");
            return;
        }

        for (const job of runningJobs) {
            await processJobResults(job);
        }

        console.log("Done!");
    } catch (error) {
        console.error("retrieve-neverbounce-job failed:", error.message);
        process.exitCode = 1;
    }
})();
