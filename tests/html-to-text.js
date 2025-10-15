const _ = require("../src/Helpers");

const email =
    "<div>Hi Ryan,</div><div><br /></div><div>The roof at 7001 Colorado Blvd caught my attention.</div><div><br /></div><div>We’re offering a roof tune-up program at no cost for select commercial properties this month. Properties like yours are a perfect match.</div><div><br /></div><div>Here's what you get:</div><ol><li>Light repairs (drain cleaning, seam sealing)</li><li>12-point inspection with a written grade for your records</li><li>Photo package for your files</li><li>If needed, a no-obligation repair estimate</li></ol><div>Would you like to jump on a quick call to discuss this?</div><div><br /></div><div><div>Kyle Shirley</div><div>CEO of Sol Vista Roofing</div><div>5855 E 45th Ave, Unit A-132, Denver, CO, 80216</div> </div>";

const text = _.htmlToText(email);

console.log(text);
