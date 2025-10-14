const express = require("express");

const parseRouter = require("./routes/prospects");
const instantlyRouter = require("./routes/instantly");

const PORT = process.env.PORT || 8080;

const app = express();

app.use(express.json({ limit: "50mb" }));

app.use("/prospects", parseRouter);
app.use("/instantly", instantlyRouter);

app.get("/", (req, res) => {
    const name = process.env.NAME || "World";
    res.send(`Hello ${name}!`);
});

app.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
});
