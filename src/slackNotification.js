require("dotenv").config();

const axios = require("axios");

module.exports = async ({ username, text, channel }) => {
    const channels = [
        {
            text,
            username,
            // icon_emoji: ":warning:",
            icon_emoji: ":email:",
            unfurl_links: true,
            channel: "#errors",
        },
        {
            text,
            username,
            icon_emoji: ":mailbox_with_mail:",
            unfurl_links: true,
            channel: "#email-notifications",
        },
    ];

    const payload = channels.find((el) => el.channel === channel);

    try {
        await axios.post(process.env.SLACK_WEBHOOK_URL, payload);
    } catch (error) {
        console.log("slackNotification() --", error);
    }
};
