const slackNotification = require("../src/slackNotification");

(async () => {
    try {
        await slackNotification({
            username: "Sol Vista",
            text: "There was an error",
            channel: "#errors",
        });
    } catch (error) {
        console.error(error);
    }
})();
