const _ = require("../../Helpers");

module.exports = async (reonomyData) => {
    let mobileContacts = [];
    let landlineContacts = [];
    let emailContacts = [];

    let loops = 0;

    try {
        reonomyData.forEach((property) => {
            const { stats, info } = property;

            if (stats === undefined) return;

            const formattedAddress = _.formatAddress(stats);

            const street = formattedAddress.streetAddress;
            const city = formattedAddress.city;
            const state = formattedAddress.state;
            const zip5 = formattedAddress.zip5;

            let building = {
                Url: `https://app.reonomy.com/!/property/${stats.property_id}`,
                Source: "Reonomy",
                Street: street,
                City: city,
                State: state,
                Zip: zip5,
                Address: formattedAddress.fullAddress,
                "Square Feet":
                    String(stats.building_area) === undefined ? "" : String(stats.building_area),
                "Year Built": stats.year_built || "",
                "Building Type": stats.asset_category || "",
                Floors: info.floors || "",
            };

            let owner = {
                "Owner Name": property.owners?.reported_owners[0]?.name || "",
            };

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
                };

                if (prospect.phones.length) {
                    const mobileProspects = prospect.phones
                        .filter((phone) => phone.phone_type === "mobile")
                        .map((phone) => ({
                            ...owner,
                            ...building,
                            ...contact,
                            "Phone Number": phone.number,
                            "Phone Type": phone.phone_type,
                        }));

                    mobileContacts = [...mobileContacts, ...mobileProspects];

                    const landlineProspects = prospect.phones
                        .filter((phone) => phone.phone_type !== "mobile")
                        .map((phone) => ({
                            ...owner,
                            ...building,
                            ...contact,
                            "Phone Number": phone.number,
                            "Phone Type": phone.phone_type,
                        }));

                    landlineContacts = [...landlineContacts, ...landlineProspects];
                }

                if (prospect.emails.length) {
                    const emailProspects = prospect.emails.map((email) => ({
                        ...owner,
                        ...building,
                        ...contact,
                        Email: email.address,
                        "Phone Number": "",
                        "Phone Type": "",
                    }));

                    emailContacts = [...emailContacts, ...emailProspects];
                }
            });

            if (loops % 1000 === 0) {
                console.log("Total properties scraped:", loops);
            }

            loops++;
        });

        // remove duplicates contacts
        mobileContacts = _.removeDuplicateKey(mobileContacts, "Phone Number");
        landlineContacts = _.removeDuplicateKey(landlineContacts, "Phone Number");
        emailContacts = _.removeDuplicateKey(emailContacts, "Email");

        return {
            mobileContacts,
            emailContacts,
            landlineContacts,
        };
    } catch (error) {
        console.log("ERROR reonomy.js ---", error);
        return false;
    }
};
