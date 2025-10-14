const axios = require("axios");

const _ = require("../../Helpers");
const csvToJson = require("csvtojson");

module.exports = async (url, tag) => {
    let allProspects = [];

    try {
        const { data } = await axios.get(url);

        const jsonArray = await csvToJson().fromString(data);

        for (let contact of jsonArray) {
            let prospect = {};
            prospect["Full Name"] = `${contact["First Name"]} ${contact["Last Name"]}` || "";
            prospect["First Name"] = contact["First Name"] || "";
            prospect["Last Name"] = contact["Last Name"] || "";
            prospect.Title = contact["Job Title"] || "";
            prospect.Address =
                "Street" in contact
                    ? `${contact?.Street}, ${contact?.City}, ${contact?.State} ${contact?.Zip}`
                    : "";
            prospect.Street = contact["Company Street Address"] || "";
            prospect.City = contact["Company City"] || "";
            prospect.State = contact["Company State"] || "";
            prospect.Zip = contact["Company Zip Code"] || "";
            prospect.Email = contact["Email Address"] || "";
            prospect["Company Name"] = contact["Company Name"] || "";
            prospect.Url = contact["ZoomInfo Contact Profile URL"];
            prospect.Source = "ZoomInfo";
            prospect["Source ID"] = contact["ZoomInfo Contact ID"];
            prospect.Tag = tag;

            const mobileNumber = contact["Mobile phone"];
            if (mobileNumber) {
                let mobileProspect = { ...prospect }; // Make a copy of prospect

                mobileProspect["Phone Number"] = _.onlyDigits(mobileNumber);
                mobileProspect["Phone Type"] = "Mobile";
                mobileProspect.Outreach = "Text";

                allProspects.push(mobileProspect);
            }

            const directNumber = contact["Direct Phone Number"];
            if (directNumber) {
                let directProspect = { ...prospect }; // Make another copy of prospect

                directProspect["Phone Number"] = _.onlyDigits(directNumber);
                directProspect["Phone Type"] = "Landline";
                directProspect.Outreach = "Call";

                if (directNumber.toLowerCase().includes("ext.")) {
                    const [phone, ext] = directNumber.toLowerCase().split("ext.");
                    directProspect["Phone Number"] = _.onlyDigits(phone.trim());
                    directProspect.Notes = `Ext. ${ext.trim()}`;
                }

                allProspects.push(directProspect);
            }
        }

        let mobileContacts = allProspects.filter(
            (prospect) => prospect["Phone Number"] !== "" && prospect["Phone Type"] === "Mobile"
        );

        let landlineContacts = allProspects.filter(
            (prospect) => prospect["Phone Number"] !== "" && prospect["Phone Type"] === "Landline"
        );

        let emailContacts = allProspects
            .filter((prospect) => prospect.Email !== "")
            .map((prospect) => ({ ...prospect, Outreach: "Email" }));

        // * remove duplicates contacts
        mobileContacts = _.removeDuplicateKey(mobileContacts, "Phone Number");
        landlineContacts = _.removeDuplicateKey(landlineContacts, "Phone Number");
        emailContacts = _.removeDuplicateKey(emailContacts, "Email");

        return {
            mobileContacts,
            emailContacts,
            landlineContacts,
        };
    } catch (error) {
        console.log("ERROR parse.zoominfoExport() ---", error);
        return false;
    }
};
