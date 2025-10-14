const _ = require("../../Helpers");

module.exports = async (prospects, tag) => {
    let allContacts = [];

    try {
        // map over tag
        prospects.forEach((prospect) => {
            let prospectInfo = {};
            let prospectAddress = {};

            prospectInfo["Full Name"] = prospect.name || "";
            prospectInfo["First Name"] = prospect.firstName || "";
            prospectInfo["Last Name"] = prospect.lastName || "";
            prospectInfo.Title = prospect.title || "";
            prospectInfo["Company Name"] = prospect.companyName || "";
            prospectInfo.Email = prospect.email || "";
            prospectInfo.Url =
                `https://app.zoominfo.com/#/apps/profile/person/${prospect.personID}/contact-profile` ||
                "";
            prospectInfo["Source ID"] = String(prospect.personID);
            prospectInfo.Source = "ZoomInfo";
            prospectInfo.Tag = tag;

            prospectAddress.Street = prospect.location?.Street || "";
            prospectAddress.City = prospect.location?.City || "";
            prospectAddress.State = prospect.location?.State || "";
            prospectAddress.Zip = prospect.location?.Zip || "";

            if (prospect.mobilePhone) {
                let mobileProspectInfo = { ...prospectInfo }; // Make a copy of prospect

                mobileProspectInfo["Phone Number"] = _.onlyDigits(prospect.mobilePhone);
                mobileProspectInfo["Phone Type"] = "Mobile";
                mobileProspectInfo.Outreach = "Text";

                allContacts.push({
                    ...mobileProspectInfo,
                    ...prospectAddress,
                });
            }

            if (prospect.phone) {
                let landlineProspectInfo = { ...prospectInfo }; // Make a copy of prospect

                landlineProspectInfo["Phone Number"] = _.onlyDigits(prospect.phone);
                landlineProspectInfo["Phone Type"] = "Landline";
                landlineProspectInfo.Outreach = "Call";

                if (prospect.phone.toLowerCase().includes("ext.")) {
                    const [phone, ext] = prospect.phone.toLowerCase().split("ext.");
                    landlineProspectInfo["Phone Number"] = _.onlyDigits(phone.trim());
                    landlineProspectInfo.Notes = `Ext. ${ext.trim()}`;
                }

                allContacts.push({
                    ...landlineProspectInfo,
                    ...prospectAddress,
                });
            }
        });

        let mobileContacts = allContacts.filter((prospect) => prospect["Phone Type"] === "Mobile");

        let landlineContacts = allContacts.filter(
            (prospect) => prospect["Phone Type"] === "Landline"
        );

        let emailContacts = allContacts
            .filter((prospect) => prospect.Email)
            .map((prospect) => ({
                ...prospect,
                Outreach: "Email",
            }));

        mobileContacts = _.removeDuplicateKey(mobileContacts, "Phone Number");
        landlineContacts = _.removeDuplicateKey(landlineContacts, "Phone Number");
        emailContacts = _.removeDuplicateKey(emailContacts, "Email");

        return {
            mobileContacts,
            landlineContacts,
            emailContacts,
        };
    } catch (error) {
        console.log("ERROR ---", error);
        return false;
    }
};
