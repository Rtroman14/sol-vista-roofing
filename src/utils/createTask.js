require("dotenv").config();

const { CloudTasksClient } = require("@google-cloud/tasks");

const client = new CloudTasksClient();

process.on("unhandledRejection", (err) => {
    console.error(err.message);
    process.exitCode = 1;
});

module.exports = async ({ queue, url, payload, inSeconds }) => {
    try {
        const project = process.env.PROJECT_ID;
        // const queue = process.env.QUEUE_ID;
        const location = "us-central1";
        // const url = process.env.CLOUD_FUNCTION_URL;
        const serviceAccountEmail = process.env.SERVICE_ACCOUNT_EMAIL;
        // const payload = { message: "Hello, World!" };

        // Construct the fully qualified queue name.
        const parent = client.queuePath(project, location, queue);

        // const inSeconds = 10;

        const task = {
            httpRequest: {
                headers: {
                    "Content-Type": "application/json", // Set content type to ensure compatibility your application's request parsing
                },
                httpMethod: "POST",
                url,
                oidcToken: {
                    serviceAccountEmail,
                },
                body: Buffer.from(JSON.stringify(payload)).toString("base64"),
            },
            scheduleTime: {
                seconds: inSeconds + Date.now() / 1000,
            },
        };

        console.log("Sending task:");
        console.log(task);

        // Send create task request.
        const request = { parent, task };
        const [response] = await client.createTask(request);
        const name = response.name;
        console.log(`Created task ${name}`);

        return response;
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
        return false;
    }
};
