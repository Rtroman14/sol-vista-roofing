require("dotenv").config();

const axios = require("axios");

class NeverbounceApi {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error("Using Neverbounce requires an API key.");
        }

        this.apiKey = apiKey;
        this.baseURL = "https://api.neverbounce.com/v4.2";
        this.headers = {
            headers: {
                "Content-Type": "application/json",
            },
        };
    }

    async createJob(input, options = {}) {
        try {
            const payload = {
                key: this.apiKey,
                input_location: "supplied",
                input,
                filename: options.filename || "EmailValidation.csv",
                auto_parse: options.auto_parse === undefined ? true : options.auto_parse,
                auto_start: options.auto_start === undefined ? true : options.auto_start,
                allow_manual_review: options.allow_manual_review || false,
                callback_url: options.callback_url,
                callback_headers: options.callback_headers,
            };

            Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

            const { data } = await axios.post(`${this.baseURL}/jobs/create`, payload, this.headers);

            return { success: true, data };
        } catch (error) {
            const message = error.response?.data || error.message;
            console.error("Neverbounce.createJob() -->", message);
            return { success: false, error: message };
        }
    }

    async getJobResults(jobId) {
        try {
            let allResults = [];

            const url = `${this.baseURL}/jobs/results`;
            const firstPageParams = {
                key: this.apiKey,
                job_id: jobId,
                page: 1,
                items_per_page: 1000,
            };

            const { data: firstPageData } = await axios.get(url, {
                params: firstPageParams,
                headers: this.headers.headers,
            });

            const totalPages = firstPageData.total_pages || 1;
            allResults = [...allResults, ...(firstPageData.results || [])];

            for (let page = 2; page <= totalPages; page++) {
                const params = {
                    key: this.apiKey,
                    job_id: jobId,
                    page,
                    items_per_page: 1000,
                };

                const { data } = await axios.get(url, {
                    params,
                    headers: this.headers.headers,
                });

                allResults = [...allResults, ...(data.results || [])];
            }

            return { success: true, data: { ...firstPageData, results: allResults } };
        } catch (error) {
            const message = error.response?.data || error.message;
            console.error("Neverbounce.getJobResults() -->", message);
            return { success: false, error: message };
        }
    }
}

module.exports = new NeverbounceApi(process.env.NEVERBOUNCE_API);
