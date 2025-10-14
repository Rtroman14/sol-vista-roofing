const _ = require("../../Helpers");

module.exports = async (reonomyData, tag) => {
    let mobileContacts = [];
    let emailContacts = [];

    reonomyData = reonomyData.filter((el) => el.prospects?.length);

    try {
        reonomyData.forEach((property) => {
            const { stats } = property;

            if (stats === undefined) return;

            const formattedAddress = _.formatAddress(stats);

            const street = formattedAddress.streetAddress;
            const city = formattedAddress.city;
            const state = formattedAddress.state;
            const zip5 = formattedAddress.zip5;

            let buildingArea = stats.building_area;

            if (buildingArea === undefined) {
                buildingArea = "";
            }
            if (String(stats.building_area) === undefined) {
                buildingArea = "";
            }
            if (typeof stats.building_area === "number") {
                buildingArea = String(stats.building_area);
            }

            let building = {
                Url: `https://app.reonomy.com/!/property/${stats.property_id}`,
                Source: "Reonomy",
                Street: street,
                City: city,
                State: state,
                Zip: zip5,
                Address: formattedAddress.fullAddress,
                "Square Feet": buildingArea,
                "Year Built": stats.year_built || "",
                "Building Type": stats.asset_category || "",
            };

            if (property.prospects === undefined) {
                console.log("TRUE");
            }

            property.prospects.forEach((prospect) => {
                const { addresses } = prospect;

                const firstName = prospect.name.first || "There";
                const lastName = prospect.name.last || "";

                let contactAddress = "";

                if (addresses.length) {
                    const address = addresses[0];
                    contactAddress = `${address.line1}, ${address.city}, ${address.state} ${address.postal_code}`;
                }

                let title = "";

                if (prospect.companies?.length) {
                    title = prospect.companies[0].title?.[0] || "";
                } else {
                    if (prospect.is_property_owner) {
                        title = "Owner";
                    }
                }

                let contact = {
                    "Full Name": `${firstName} ${lastName}`,
                    "First Name": firstName,
                    "Last Name": lastName,
                    "Contact Address": contactAddress || "",
                    "Properties in Portfolio": String(prospect.properties_count) || "",
                    "Portfolio Assessed Value": String(prospect.assd_total_value) || "",
                    "Last Acquisition Date": prospect.most_recent_acquisition_date || "",
                    Title: title,
                    // "Source ID": prospect.id,
                    "Source ID": stats.property_id,
                };

                if (prospect.phones.length) {
                    let email = "";

                    if (prospect.emails.length) {
                        email = prospect.emails[0].address;
                    }
                    const mobileProspects = prospect.phones
                        .filter((phone) => phone.phone_type === "mobile")
                        .map((phone) => ({
                            ...building,
                            ...contact,
                            "Phone Number": phone.number,
                            Outreach: "Text",
                            Tag: tag,
                            // Email: email,
                        }));

                    mobileContacts = [...mobileContacts, ...mobileProspects];
                }

                if (prospect.emails.length) {
                    const emailProspects = prospect.emails.map((email) => ({
                        ...building,
                        ...contact,
                        Email: email.address,
                        Outreach: "Email",
                        Tag: tag,
                    }));

                    emailContacts = [...emailContacts, ...emailProspects];
                }
            });
        });

        // remove duplicates contacts
        mobileContacts = _.removeDuplicateKey(mobileContacts, "Phone Number");
        emailContacts = _.removeDuplicateKey(emailContacts, "Email");

        return {
            mobileContacts,
            emailContacts,
        };
    } catch (error) {
        console.log("ERROR reonomy.js ---", error);
        return false;
    }
};
