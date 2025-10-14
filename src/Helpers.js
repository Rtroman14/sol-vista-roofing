require("dotenv").config();

const axios = require("axios");

class Helpers {
    filterValidEmails = (results) => {
        return results
            .filter((email) => email.verification.result === "valid")
            .map((item) => item.data)
            .map((contact) => {
                let email = contact.email;
                delete contact.email;
                return {
                    ...contact,
                    Email: email,
                };
            });
    };

    formatAirtableContacts = (contacts) => contacts.map((contact) => ({ fields: { ...contact } }));

    readFiles = async (record) => {
        let prospects = [];

        for (let file of record.Data) {
            const { data } = await axios.get(file.url);
            prospects = [...prospects, ...data];
        }

        return prospects;
    };

    readFilesV2 = async (files) => {
        let prospects = [];

        for (let file of files) {
            const { data } = await axios.get(file.url);
            prospects = [...prospects, ...data];
        }

        return prospects;
    };

    arrayDifference = (newArray, array, key) =>
        newArray.filter(
            ({ [key]: value1 }) => !array.some(({ [key]: value2 }) => value2 === value1)
        );

    reformatContact = (department, num, contact) => {
        const newContact = {};

        newContact["Full Name"] = contact[`${department}_Name_${num}`] || "";
        newContact["First Name"] = contact[`${department}_Name_${num}`].split(" ")[0] || "";
        newContact["Last Name"] =
            contact[`${department}_Name_${num}`].split(" ").slice(1).join(" ") || "";
        newContact["Phone Number"] = contact[`${department}_Phone_${num}`] || "";
        newContact["Square Feet"] = contact.sf || "";
        newContact["Address"] = contact.address || "";
        newContact["Street"] = contact.street || "";
        newContact["City"] = contact.city || "";
        newContact["State"] = contact.state || "";
        newContact["Zip"] = contact.zip || "";
        newContact["Email"] = contact[`${department}_Email_${num}`] || "";
        newContact["Company Name"] = contact[`${department}_Company`] || "";
        newContact.Source = "CoStar";

        return newContact;
    };

    between = (min, value, max) => value >= min && value <= max;

    findValue = (column, yMin, yMax) => {
        const value = column.find((el) => this.between(yMin, el.y, yMax));

        return value ? value.str : "";
    };

    isPhoneNumber = (phoneNumber) => {
        const phoneNumberRegex =
            /^(\+\d{1,2}\s?)?1?\-?\.?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/gm;

        const isPhoneNumber = phoneNumberRegex.test(phoneNumber);

        return isPhoneNumber;
    };

    numDigits = (phoneNumber) => phoneNumber.replace(/[^0-9]/g, "").length;

    removeDuplicateKey = (array, key) =>
        array.filter(
            (element, index, arr) => arr.findIndex((el) => el[key] === element[key]) === index
        );

    zoomInfoContact = (prospect) => {
        return {
            "Full Name": prospect.name || "",
            "First Name": prospect.firstName || "",
            "Last Name": prospect.lastName || "",
            Title: prospect.title || "",
            Street: prospect.location?.Street || "",
            City: prospect.location?.City || "",
            State: prospect.location?.State || "",
            Zip: prospect.location?.Zip || "",
            "Phone Number": prospect.mobilePhone || "",
            Email: prospect.email || "",
            "Company Name": prospect.companyName || "",
            Url:
                `https://app.zoominfo.com/#/apps/profile/person/${prospect.personID}/contact-profile` ||
                "",
            Source: "ZoomInfo",
            id: String(prospect.personID),
        };
    };

    onlyDigits = (phoneNumber) => phoneNumber?.replace(/\D/g, "") || "";

    captializeSentence = (sentence) => {
        const words = sentence.toLowerCase().split(" ");

        return words
            .map((word) => {
                return word[0].toUpperCase() + word.substring(1);
            })
            .join(" ");
    };

    formatAddress = (stats) => {
        let address = {
            name: "",
            houseNumber: "",
            directionLeft: "",
            directionRight: "",
            mode: "",
            street: "",
            state: "",
            zip5: "",
        };

        let streetAddress = [];
        let addressName = [];

        // * Street
        if ("house_nbr" in stats) {
            streetAddress.push(stats.house_nbr);
        }
        if ("direction_left" in stats) {
            streetAddress.push(stats.direction_left);
            address.directionLeft = stats.direction_left;
        }
        if ("street" in stats) {
            streetAddress.push(this.captializeSentence(stats.street));
            address.street = this.captializeSentence(stats.street);
        }
        if ("mode" in stats) {
            streetAddress.push(stats.mode);
            address.mode = stats.mode;
        }
        if ("direction_right" in stats) {
            streetAddress.push(stats.direction_right);
            address.directionRight = stats.direction_right;
        }
        streetAddress = streetAddress.join(" ");
        addressName.push(`${streetAddress},`);

        if ("city" in stats) {
            addressName.push(`${this.captializeSentence(stats.city)},`);
            address.city = this.captializeSentence(stats.city);
        }

        stats.zip5 && addressName.push(stats.zip5);

        address.houseNumber = stats?.house_nbr || "";
        address.state = stats?.state || "";
        address.zip5 = stats?.zip5 || "";
        address.fullAddress = addressName.join(" ");
        address.streetAddress = streetAddress;

        return address;
    };

    scrubNumbers = async (phoneNumberArray) => {
        if (!phoneNumberArray.length) return false;

        try {
            const { data } = await axios.post(
                "https://api.blacklistalliance.net/bulklookup",
                {
                    phones: phoneNumberArray,
                },
                {
                    params: {
                        key: process.env.BLACK_ALLIANCE_KEY,
                        ver: "v3",
                        resp: "json",
                    },
                    headers: {
                        accept: "application/json",
                        "Content-Type": "application/json",
                    },
                }
            );

            return data;
        } catch (error) {
            console.error(error);
            return false;
        }
    };

    scrubAllMobileContacts = async (mobileContacts) => {
        const BATCH_CONTACTS = 100;
        let allSupressedNumbers = [];

        let iterations = Math.ceil(mobileContacts.length / BATCH_CONTACTS);

        try {
            for (let i = 0; i <= iterations; i++) {
                const start = i * BATCH_CONTACTS;
                const end = start + BATCH_CONTACTS;
                const mobileContactsBatch = mobileContacts.slice(start, end);

                const phoneNumbersArray = mobileContactsBatch.map(
                    (contact) => contact["Phone Number"]
                );

                const scrubbedNumbers = await this.scrubNumbers(phoneNumbersArray);

                if (scrubbedNumbers) {
                    allSupressedNumbers = [...allSupressedNumbers, ...scrubbedNumbers.supression];
                }
            }

            const filteredContacts = mobileContacts.filter(
                (contact) => !allSupressedNumbers.includes(contact["Phone Number"])
            );

            return {
                success: true,
                data: filteredContacts,
            };
        } catch (error) {
            console.error(error);
            return {
                success: false,
                data: mobileContacts,
                error: error.message,
            };
        }
    };

    containsFilterOutWords = (filterOutWords, str) => {
        // Escape special regex characters and create a regex pattern
        const escapedWords = filterOutWords.map((word) =>
            word.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")
        );
        const pattern = new RegExp(escapedWords.join("|"), "i"); // Case-insensitive
        return pattern.test(str);
    };

    splitArrayIntoChunks = (array, chunkSize) => {
        let chunks = [];

        // Use a for loop to iterate over the original array and split it into chunks
        for (let i = 0; i < array.length; i += chunkSize) {
            // Use the slice method to create a chunk and push it into the chunk array
            let chunk = array.slice(i, i + chunkSize);
            chunks.push(chunk);
        }

        // Return the new array with chunks
        return chunks;
    };
}

module.exports = new Helpers();
