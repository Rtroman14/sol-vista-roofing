require("dotenv").config();

const Airtable = require("../src/Airtable");

const BASE_ID = "appQnw7GBSDCatAzf";
const PROPERTIES_TABLE = "Properties";

// Helper function to convert text to proper title case
const toTitleCase = (str) => {
    if (!str) return str;

    return str
        .toLowerCase()
        .split(" ")
        .map((word) => {
            // Keep certain abbreviations uppercase
            const uppercaseWords = [
                "N",
                "S",
                "E",
                "W",
                "NE",
                "NW",
                "SE",
                "SW",
                "NNE",
                "NNW",
                "SSE",
                "SSW",
            ];
            if (uppercaseWords.includes(word.toUpperCase())) {
                return word.toUpperCase();
            }

            // Capitalize first letter of each word
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");
};

// Helper function to standardize Street and City fields
const standardizeAddress = (street, city) => {
    const standardizedStreet = street ? toTitleCase(street.trim()) : street;
    const standardizedCity = city ? toTitleCase(city.trim()) : city;

    return {
        Street: standardizedStreet,
        City: standardizedCity,
    };
};

// Fetch all properties from the Properties table
const fetchAllProperties = async () => {
    try {
        const base = await Airtable.config(BASE_ID);
        const records = await base(PROPERTIES_TABLE).select().all();

        const properties = records.map((record) => ({
            id: record.getId(),
            Street: record.fields.Street,
            City: record.fields.City,
        }));

        return properties;
    } catch (error) {
        console.error("Error fetching properties:", error.message);
        return [];
    }
};

// Update properties in batches of 10
const batchUpdateProperties = async (properties) => {
    const batchSize = 10;
    const totalBatches = Math.ceil(properties.length / batchSize);

    console.log(`Updating ${properties.length} properties in ${totalBatches} batches...`);

    for (let i = 0; i < totalBatches; i++) {
        const batch = properties.slice(i * batchSize, (i + 1) * batchSize);
        const records = batch.map((prop) => {
            const standardized = standardizeAddress(prop.Street, prop.City);
            return {
                id: prop.id,
                fields: standardized,
            };
        });

        const updated = await Airtable.updateRecords(BASE_ID, PROPERTIES_TABLE, records);
        if (!updated) {
            console.warn(`Failed to update batch ${i + 1} of ${totalBatches}`);
        } else {
            console.log(`Updated batch ${i + 1}/${totalBatches}`);
        }
    }

    console.log("All properties updated!");
};

(async () => {
    try {
        console.log("Fetching all properties...");
        const properties = await fetchAllProperties();

        console.log(`Found ${properties.length} properties`);
        if (properties.length === 0) {
            console.log("No properties found.");
            return;
        }

        console.log("\nSample before standardization:");
        console.log(properties.slice(0, 3));

        console.log("\nStarting batch update...");
        await batchUpdateProperties(properties);

        console.log("\nDone! All properties have been standardized.");
    } catch (error) {
        console.error("enrich-addresses failed:", error.message);
        process.exitCode = 1;
    }
})();
