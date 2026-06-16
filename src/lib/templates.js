export const DEFAULT_TEMPLATES = [
  {
    id: "linkedin-cold",
    name: "LinkedIn Cold Outreach",
    body: "Hi {{firstName}}, I'm a recently graduated aerospace engineer (MS UIUC, Dec 2025) with quality and manufacturing experience on GE Aerospace and Boeing programs — {{myAchievement}}. I noticed {{company}} is hiring for {{role}} and would love to connect and learn more about the team. Would you be open to a quick chat?"
  },
  {
    id: "recruiter-msg",
    name: "Recruiter Message",
    body: "Hi {{firstName}}, I'm reaching out about the {{role}} opening at {{company}}. MS Aerospace grad (UIUC, Dec 2025), STEM OPT — 3 years, zero sponsorship cost to employer. Six Sigma Green Belt. Background in quality systems and aerospace manufacturing (8D, pFMEA, SPC, CMM) — Tata Boeing on GE and Boeing programs. Happy to share my resume if there's a fit.\n\nBest,\nSiddardth"
  },
  {
    id: "referral-ask",
    name: "Referral Ask",
    body: "Hi {{firstName}}, I came across your profile while researching {{company}}. I'm applying for {{role}} and have a background in quality engineering and aerospace manufacturing — Tata Boeing (GE/Boeing programs), SAMPE composite fuselage (2,700 lbf first-article), Six Sigma Green Belt. If you're open to it, I'd really value your perspective on the team — happy to share my resume."
  },
  {
    id: "cover-letter",
    name: "Cover Letter",
    body: "Dear Hiring Manager,\n\nI am writing to apply for the {{role}} position at {{company}}. As an MS Aerospace Engineering graduate from UIUC (December 2025) with a Six Sigma Green Belt and NPTEL certification in Inspection & Quality Control, I bring hands-on quality and manufacturing experience from GE Aerospace and Boeing programs.\n\nAt Tata Boeing, I introduced 8D structured problem-solving into the MRB process, cutting nonconformance cycle time by 22%, and implemented SPC-guided corrective actions that reduced position tolerance defect rates from 15% to under 3%. At SAMPE, I built a 24-inch composite fuselage via prepreg layup and autoclave cure — achieving first-article structural acceptance with the part sustaining 2,700 lbf at test (2.7× design requirement).\n\nI am available on STEM OPT for 3 years with no sponsorship cost to the employer, and I am excited about the opportunity to contribute to {{company}}.\n\nSincerely,\nSiddardth Pathipaka"
  },
  {
    id: "contract-outreach",
    name: "Contract / Staffing Recruiter",
    body: "Hi {{firstName}}, I'm a recently graduated aerospace engineer (MS UIUC, Dec 2025) actively looking for contract quality or manufacturing engineering roles. Six Sigma Green Belt. Background: quality systems on GE Aerospace and Boeing programs at Tata Boeing — 8D, SPC, pFMEA, CMM inspection. Available immediately on STEM OPT (3 years, no sponsorship cost). Open to aerospace, defense-adjacent, or advanced manufacturing roles. Would you have anything relevant in your pipeline?\n\nBest,\nSiddardth"
  }
];

export function fillTemplate(template, vars) {
  let result = template.body || template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value || '');
  }
  return result;
}
