const _ = require("../../Helpers");

// const titles = require("./titles");

module.exports = async (data, tag) => {
    // const re = new RegExp(titles, "i");

    let prospects = [];

    try {
        for (let property of data) {
            let prospect = {};

            prospect.Address = property.address_full;
            prospect.Street = property.address_line_1;
            prospect.City = property.address_city;
            prospect.State = property.address_state;
            prospect.Zip = property.address_postal_code.toString() || "";
            prospect.Url = property.link;
            prospect["Building Type"] = `${property.property_type} | ${property.property_subtype}`;
            prospect["Square Feet"] = property.gross_building_area.toString() || "";
            prospect["Year Built"] = property.year_built.toString() || "";
            prospect["Company Name"] = property.reported_owner_name;
            prospect["Company Address"] = property.reported_mailing_address_full;
            prospect.Source = "Reonomy Export";

            // NOTE: always 3 contacts with 3 contact details
            for (let numContact = 1; numContact <= 3; numContact++) {
                if (numContact === 1) {
                    prospect["Full Name"] = property.contact_name;
                    prospect["First Name"] = property.contact_name.split(" ")[0];
                    prospect["Last Name"] = property.contact_name.split(" ").slice(1).join(" ");
                    prospect.Title = property.contact_title;
                } else {
                    prospect["Full Name"] = property[`contact_${numContact}_name`];
                    prospect["First Name"] = property[`contact_${numContact}_name`].split(" ")[0];
                    prospect["Last Name"] = property[`contact_${numContact}_name`]
                        .split(" ")
                        .slice(1)
                        .join(" ");
                    prospect.Title = property[`contact_${numContact}_title`];
                }

                for (let numInfo = 1; numInfo <= 3; numInfo++) {
                    if (numContact === 1) {
                        prospect["Phone Number"] = property[`contact_phone_${numInfo}`];
                        prospect["Phone Type"] = property[`contact_phone_${numInfo}_type`];
                        prospect.Email = property[`contact_email_${numInfo}`];
                        prospect["Prospect State"] = property[`contact_address_1_state`];
                    } else {
                        prospect["Phone Number"] =
                            property[`contact_${numContact}_phone_${numInfo}`];
                        prospect["Phone Type"] =
                            property[`contact_${numContact}_phone_${numInfo}_type`];
                        prospect.Email = property[`contact_${numContact}_email_${numInfo}`];
                        prospect["Prospect State"] =
                            property[`contact_${numContact}_address_1_state`];
                    }

                    prospects.push({ ...prospect });
                }
            }
        }

        // filter list to same state prospects
        const sameStateProspects = prospects.filter((prospect) => {
            return prospect.State === prospect["Prospect State"];
        });

        // let prospectTitles = sameStateProspects.filter((prospect) => re.test(prospect.Title));

        let mobileContacts = sameStateProspects.filter(
            (prospect) => prospect["Phone Type"] === "mobile" && prospect["Phone Type"] !== ""
        );
        let emailContacts = sameStateProspects.filter(
            (prospect) => prospect["Phone Type"] !== "Email" && prospect.Email !== ""
        );

        // remove duplicates contacts
        mobileContacts = _.removeDuplicateKey(mobileContacts, "Phone Number");
        emailContacts = _.removeDuplicateKey(emailContacts, "Email");

        // map over tag
        mobileContacts = mobileContacts.map((contact) => {
            delete contact["Prospect State"];
            delete contact["Phone Type"];

            return { ...contact, Tag: tag, Outreach: "Text" };
        });
        emailContacts = emailContacts.map((contact) => {
            delete contact["Prospect State"];
            delete contact["Phone Type"];
            delete contact["Phone Number"];

            return { ...contact, Tag: tag, Outreach: "Email" };
        });

        let emails = [];

        mobileContacts = mobileContacts.map((prospect) => {
            if (emails.includes(prospect.Email)) {
                return { ...prospect, Email: "" };
            }
            emails.push(prospect.Email);
            return prospect;
        });

        return {
            mobileContacts,
            emailContacts,
        };
    } catch (error) {
        console.log("ERROR reonomyExport.js ---", error);
        return false;
    }
};
