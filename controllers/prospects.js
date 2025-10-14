require("dotenv").config();

const Airtable = require("../src/Airtable");
const HighLevelAPI = require("../src/HighLevel");
const _ = require("../src/Helpers");
const Kixie = require("../src/Kixie");

const createTask = require("../src/utils/createTask");

const updatedFields = {
    "In Campaign": true,
    Status: "DND",
    Responded: true,
};

const setDND = async (req, res, next) => {
    let { baseID, recordID, phoneNumber } = req.body;

    try {
        // * format phone number to only digits
        phoneNumber = _.onlyDigits(phoneNumber);

        // * fetch filtered contact(s) from every base
        let campaigns = await Airtable.getRecordsByView(baseID, "Campaigns", "Text - workflow");

        const accounts = _.removeDuplicateKey(campaigns, "API Token");

        const filteredContactsReq = accounts.map((account) =>
            Airtable.getFilteredProspects(
                account["Base ID"],
                account["API Token"],
                `IF(SEARCH("${phoneNumber}",{Phone Number}) >= 1, TRUE(), FALSE())`
            )
        );

        const filteredContactsRes = await Promise.all(filteredContactsReq);

        const filteredContacts = filteredContactsRes.flat();

        console.log("filteredContacts.length:", filteredContacts.length);

        // * Update AT record
        const updateContactReq = filteredContacts.map((contact) =>
            Airtable.updateRecord(contact.baseID, "Prospects", contact.recordID, updatedFields)
        );

        const response = await Promise.all(updateContactReq);

        const atLogs = `Set DND to ${String(response.length)} contacts in Airtable`;
        console.log(atLogs);

        let numHLContacts = 0;
        let numHLContactsDND = 0;

        // * Set DND to contact in HL
        for (let contact of filteredContacts) {
            if ("id" in contact) {
                const HighLevel = new HighLevelAPI(contact.hlAPI);

                const hlContact = await HighLevel.updateContact(contact.id, { dnd: true });

                hlContact.dnd && numHLContactsDND++;
                numHLContacts++;
            }
        }

        const hlLogs = `Set DND to ${String(numHLContactsDND)} out of ${String(
            numHLContacts
        )} contacts in Highlevel.`;
        console.log(hlLogs);

        await Airtable.updateRecord(baseID, "DND", recordID, {
            Status: "Complete",
            Logs: `${atLogs}\n${hlLogs}`,
        });

        // * remove contact from powerlist
        await Kixie.removeFromPowerlist([phoneNumber]);

        return res.json({ success: true, message: `Set ${phoneNumber} to DND` });
    } catch (error) {
        console.error(`ERROR -- setDND() -- ${error.message}`);

        await Airtable.updateRecord(baseID, "DND", recordID, {
            Status: "Error",
            Logs: error.message,
        });
    }
};

const taskToParseApollo = async (req, res, next) => {
    let { baseID, recordID } = req.body;

    try {
        const record = await Airtable.getRecord(baseID, "Reonomy", recordID);

        const task = await createTask({
            queue: process.env.QUEUE_ID,
            url: process.env.CLOUD_FUNCTION_URL,
            payload: { record, baseID },
            inSeconds: 10,
        });

        return res.json({ success: true, data: task });
    } catch (error) {
        console.error(`ERROR -- taskToParseApollo() -- ${error.message}`);

        return res.json({
            success: false,
            message: `ERROR -- taskToParseApollo() -- ${error.message}`,
        });
    }
};

module.exports = { setDND, taskToParseApollo };
