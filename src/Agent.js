require("dotenv").config();

const { generateObject } = require("ai");
const { z } = require("zod");
const { createOpenAI } = require("@ai-sdk/openai");
const { createGoogleGenerativeAI } = require("@ai-sdk/google");
const { format } = require("date-fns");

const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});

class Agents {
    constructor() {
        const openai = createOpenAI({
            compatibility: "strict",
            apiKey: process.env.OPENAI_API_KEY,
        });

        this.model = openai("gpt-5-mini");
        this.temperature = 0;
    }

    async cleanData({ record }) {
        try {
            const result = await generateObject({
                model: this.model,
                temperature: this.temperature,
                schema: z.object({
                    fullName: z
                        .string()
                        .describe("The full name of the person, or empty string if company"),
                    firstName: z
                        .string()
                        .describe("The first name of the person, or empty string if company"),
                    lastName: z
                        .string()
                        .describe("The last name of the person, or empty string if company"),
                    companyName: z
                        .string()
                        .describe("The company name if applicable, or empty string if person"),
                    email: z.string().describe("The cleaned and lowercase email address"),
                    address: z.string().describe("The complete formatted address"),
                    street: z.string().describe("The street address portion"),
                    city: z.string().describe("The city name with proper capitalization"),
                    state: z.string().describe("The two-letter state code in uppercase"),
                    zip: z.string().describe("The 5-digit or 9-digit ZIP code"),
                }),
                system: `
## Context
You are a data cleaning specialist responsible for formatting and standardizing contact information.

## Name Processing Rules
- Analyze the "Full Name" field to determine if it represents a person or company
- For company names:
  * Set companyName to the properly formatted company name
  * Set fullName, firstName, and lastName to empty strings
  * Company indicators: LLC, INC, CORP, ASSOCIATES, PROPERTIES, MANAGEMENT, etc.
- For person names:
  * Set companyName to empty string
  * Format fullName with proper capitalization (e.g., "John Smith")
  * Extract and capitalize firstName (e.g., "John")
  * Extract and capitalize lastName (e.g., "Smith")
  * Handle middle names by including them in lastName
  * Remove any suffixes (Jr, Sr, III, etc.) while maintaining them in fullName

## Address Processing Rules
- Format the complete address with proper capitalization and spacing
- Break down the address into components:
  * street: Properly formatted street address (e.g., "123 Main Street")
  * city: Properly capitalized city name
  * state: Two-letter state code in uppercase
  * zip: 5-digit or 9-digit ZIP code
- Handle abbreviations:
  * Convert street types (ST -> Street, AVE -> Avenue, etc.)
  * Standardize directionals (N -> North, SW -> Southwest, etc.)
  * Capitalize first letter of each word except articles
  * Remove any unnecessary spaces or punctuation

## Email Processing Rules
- Convert email to lowercase
- Remove any leading/trailing whitespace
- Validate basic email format

Provide clean, standardized output that follows these formatting rules precisely.
                `,
                prompt: `
Please clean and format the following contact record:

"""
${JSON.stringify(record, null, 4)}
"""

Analyze the Full Name field to determine if it's a person or company name, then format all fields according to the specified rules.
                `,
            });

            return {
                success: true,
                data: { ...result.object, recordID: record.recordID },
            };
        } catch (error) {
            console.error("Error in cleanData:", error);
            return {
                success: false,
                message: error.message || "Failed to clean data",
            };
        }
    }

    async parseAccreditationData({ record }) {
        try {
            const result = await generateObject({
                model: google("gemini-2.0-flash-001"),
                temperature: this.temperature,
                schema: z.object({
                    state: z.string().describe("The two-letter state code"),
                    locationName: z.string().describe("The name of the location/facility"),
                    contactName: z.string().describe("The contact person's name"),
                    contactAddress: z.string().describe("The complete address"),
                    phone: z
                        .string()
                        .describe("The phone number, or empty string if not available"),
                    email: z
                        .string()
                        .describe("The email address, or empty string if not available"),
                    website: z
                        .string()
                        .describe("The website URL, or empty string if not available"),
                    firstAccredited: z.string().describe("The first accreditation date"),
                    nextVisit: z.string().describe("The next visit date"),
                    nextReview: z.string().describe("The next review date"),
                }),
                system: `
## Context
You are a data parsing specialist responsible for extracting structured information from accreditation records.

## Processing Rules
- Extract all information exactly as presented in the record
- For missing or empty fields, use empty string
- Maintain original date formats
- Keep phone numbers in original format
- Preserve exact case for emails and websites
- Extract state from the address

Parse the input text and return a structured object following these rules precisely.
                `,
                prompt: `
Please parse the following accreditation record into structured data:

"""
${record}
"""

Extract all fields according to the specified schema, maintaining original formatting where appropriate.
                `,
            });

            return {
                success: true,
                data: result.object,
            };
        } catch (error) {
            console.error("Error in parseAccreditationData:", error);
            return {
                success: false,
                message: error.message || "Failed to parse accreditation data",
            };
        }
    }

    async classifyInstantlyConversation({ conversation }) {
        try {
            const today = format(new Date(), "yyyy-MM-dd");
            const result = await generateObject({
                model: this.model,
                // temperature: this.temperature,
                schema: z.object({
                    status: z
                        .enum(["Interested", "Not Interested", "Future Follow-Up"])
                        .describe(
                            "Overall lead status. Use only these exact values: Interested, Not Interested, Future Follow-Up"
                        ),
                    followUpDate: z
                        .string()
                        .nullable()
                        .describe(
                            "If status is 'Future Follow-Up', provide an ISO date (YYYY-MM-DD) for the suggested next outreach. Otherwise null."
                        ),
                }),
                system: `
You are an expert SDR assistant for a roofing company.

TASK: Analyze an email conversation between the roofing company and a property decision maker. Classify the lead's intent and whether/when to follow up.

TODAY: ${today}

KYLE CONTEXT:
- "Kyle Shirley" represents Sol Vista Roofing.
- Kyle is reaching out to building owners and other key decision makers offering commercial roof services.

Allowed statuses and when to use them:
- Interested: Clear interest or positive intent (e.g., asking for an inspection, pricing, calling back, meeting). No date.
- Not Interested: Explicit decline, unsubscribe/do-not-contact, wrong contact with no referral, or otherwise closed off. No date.
- Future Follow-Up: Use ONLY if the recipient explicitly requests contact at a future time (e.g., "follow up next week", "reach out after Q2", "email me in two weeks"). Out-of-office or generic "busy" responses WITHOUT an explicit request to contact later are NOT Future Follow-Up.

Rules:
- Only return the three allowed statuses exactly as written.
- If status is Future Follow-Up, followUpDate must be a valid ISO date string (YYYY-MM-DD). Otherwise set followUpDate to null.
- If the recipient provides a specific date or time window, convert it to an ISO date on or after TODAY.
- If the recipient requests a future follow-up but gives no specific timing, set followUpDate to a sensible date between 7 and 30 days from TODAY (default 14 days).
                `,
                prompt: `
CONVERSATION:
"""
${typeof conversation === "string" ? conversation : JSON.stringify(conversation, null, 2)}
"""

Return only the structured object per the schema.
                `,
            });

            return {
                success: true,
                data: result.object,
            };
        } catch (error) {
            console.error("Error in classifyInstantlyConversation:", error);
            return {
                success: false,
                message: error.message || "Failed to classify conversation",
            };
        }
    }
}

module.exports = new Agents();
