const VARIANT_KEYWORDS = {
  A: {
    name: "Manufacturing & Plant Ops",
    primary: ["gd&t","gdandt","cmm","fixtures","jigs","dimensional inspection","metrology","tolerance","manufacturing engineer","assembly","plant operations","ppap","first article","fai","as9100","nadcap","production","machining","quality control","inspection","coordinate measuring"],
    secondary: ["shop floor","cnc","line balancing","capacity planning","stamping","casting","forging","welding","production planning"]
  },
  B: {
    name: "Process & CI",
    primary: ["fmea","pfmea","dfmea","spc","8d","lean","kaizen","six sigma","dmaic","continuous improvement","process engineer","vsm","value stream","poka-yoke","5s","root cause","capa","oee","defect reduction","process improvement","corrective action"],
    secondary: ["process optimization","cycle time","throughput","waste reduction","process validation","efficiency","yield improvement"]
  },
  C: {
    name: "Quality & Materials",
    primary: ["cmm","mrb","composites","quality assurance","ndt","non-destructive","capa","as9100","iso 9001","material review board","nonconformance","prepreg","autoclave","carbon fiber","cfrp","layup","vacuum bagging","materials engineer","composite structures","quality engineer"],
    secondary: ["supplier quality","incoming inspection","fiber reinforced","thermoplastic","certification","composite manufacturing","ultrasonics"]
  },
  D: {
    name: "Equipment & NPI",
    primary: ["tooling","pfmea","doe","design of experiments","npi","new product introduction","equipment engineer","process development","validation","qualification","iq oq pq","commissioning","prototype","apqp","r&d","manufacturing readiness"],
    secondary: ["product development","design review","tool design","fixture design","production launch","capital equipment"]
  }
};

const TEMPLATE_SUMMARIES = {
  A: "Manufacturing engineer with expertise in GD&T, CMM inspection, and fixture design. Reduced defect rates from 15% to 3% through SPC implementation at Tata Boeing. STEM OPT — 3 years, no sponsorship cost.",
  B: "Process and continuous improvement engineer with hands-on FMEA, SPC, and 8D problem-solving experience. Drove 15% to 3% defect reduction via lean methodology. STEM OPT — 3 years, no sponsorship cost.",
  C: "Quality and materials engineer with composites manufacturing and CMM inspection experience. Built 24-inch composite fuselage — part sustained 2,700 lbf at test (2.7× design requirement). STEM OPT — 3 years, no sponsorship cost.",
  D: "Equipment and NPI engineer experienced in tooling design, DOE, and process validation. Reduced cure cycle from 8 hours to 5 minutes at Beckman Institute. STEM OPT — 3 years, no sponsorship cost."
};

// LaTeX skillline format — copy-paste directly into Overleaf
const TEMPLATE_SKILLS = {
  A: `\\skillline{Certifications:}{Six Sigma Green Belt (CSSC) \\textbar\\ Inspection \\& Quality Control in Manufacturing (NPTEL -- IIT Roorkee)}
\\skillline{Quality / Analysis:}{pFMEA, SPC, 8D Root Cause Analysis, RCCA, CMM Inspection, GD\\&T, First Article Inspection, CAPA, MRB Disposition}
\\skillline{Manufacturing / Process:}{Prepreg Layup, Autoclave Processing, Cure Cycle Development, AS9100, Process Validation, Lean Principles, NADCAP}
\\skillline{Tools / Software:}{SolidWorks, CATIA, MATLAB, Python, AutoCAD}`,

  B: `\\skillline{Certifications:}{Six Sigma Green Belt (CSSC) \\textbar\\ Inspection \\& Quality Control in Manufacturing (NPTEL -- IIT Roorkee)}
\\skillline{Quality / Analysis:}{pFMEA, SPC, 8D Root Cause Analysis, RCCA, DMAIC, CAPA, MRB Disposition}
\\skillline{Process / CI:}{Value Stream Mapping, Poka-Yoke, 5S, OEE, Defect Reduction, Lean Principles, Kaizen, Process Validation, Corrective Action}
\\skillline{Tools / Software:}{SolidWorks, MATLAB, Python, Minitab, AutoCAD}`,

  C: `\\skillline{Certifications:}{Six Sigma Green Belt (CSSC) \\textbar\\ Inspection \\& Quality Control in Manufacturing (NPTEL -- IIT Roorkee)}
\\skillline{Quality / Analysis:}{pFMEA, SPC, 8D Root Cause Analysis, RCCA, MRB Disposition, CAPA, GD\\&T, CMM Inspection, First Article Inspection}
\\skillline{Materials / Process:}{Prepreg Layup, Autoclave Processing, Vacuum Bagging, Cure Cycle Development, Out-of-Autoclave Methods, NDT, AS9100}
\\skillline{Tools / Software:}{ABAQUS, FEA, Classical Lamination Theory, SolidWorks, MATLAB, Python, AutoCAD}`,

  D: `\\skillline{Certifications:}{Six Sigma Green Belt (CSSC) \\textbar\\ Inspection \\& Quality Control in Manufacturing (NPTEL -- IIT Roorkee)}
\\skillline{Quality / Analysis:}{pFMEA, RCCA, CAPA, 8D Root Cause Analysis, SPC, First Article Inspection, CMM Inspection}
\\skillline{NPI / Tooling:}{DOE, APQP, Process Validation, New Product Introduction, Design Review, Manufacturing Readiness, IQ/OQ/PQ}
\\skillline{Tools / Software:}{SolidWorks, CATIA, FEA, MATLAB, Python, AutoCAD}`,
};

/**
 * Pick the uploaded resume that best matches a JD by skill keyword overlap.
 * Falls back to primary or first resume if no keywords match.
 * resumes must include structured_sections (use fetchAllResumesWithSections).
 */
export function selectBestResume(resumes, jdText) {
  if (!resumes?.length) return null;
  const text = jdText.toLowerCase();
  let best = null, bestScore = -1;
  for (const resume of resumes) {
    const keywords = (resume.structured_sections?.skills || [])
      .flatMap(s => s.items || [])
      .map(k => k.toLowerCase().trim())
      .filter(Boolean);
    const hits = keywords.filter(k => text.includes(k)).length;
    if (hits > bestScore) { bestScore = hits; best = resume; }
  }
  return best || resumes.find(r => r.is_primary) || resumes[0];
}

/**
 * Local keyword analysis. When a resume is provided its skill items are used
 * directly; otherwise falls back to the hardcoded VARIANT_KEYWORDS profiles.
 */
export function analyzeJob(jdText, resume = null) {
  const text = jdText.toLowerCase();
  const compositeTerms = ['composites','cfrp','prepreg','autoclave','layup','carbon fiber'];
  const composites_visible = compositeTerms.some(t => text.includes(t));
  const hasMetrics = /\d+%|\d+\s*(years?|months?|units?|parts?|%)/i.test(jdText);
  const quantification_check = hasMetrics ? "Metrics present" : "Add metrics";

  if (resume?.structured_sections) {
    const allKeywords = (resume.structured_sections.skills || [])
      .flatMap(s => s.items || [])
      .map(k => k.toLowerCase().trim())
      .filter(Boolean);
    const top_matches = allKeywords.filter(k => text.includes(k)).slice(0, 8);
    const missing_keywords = allKeywords.filter(k => !text.includes(k)).slice(0, 5);
    const rawScore = allKeywords.length > 0 ? (top_matches.length / allKeywords.length) * 100 : 0;
    return {
      recommendedResume: resume.name,
      recommendedResumeId: resume.id,
      resumeReason: `Best skill overlap with "${resume.name}" (${Math.round(rawScore)}% keyword match)`,
      ats_coverage: Math.min(92, Math.max(25, Math.round(rawScore))) + '%',
      missing_keywords,
      composites_visible,
      quantification_check,
      mod1_summary: '',
      mod2_skills: '',
      top_matches,
    };
  }

  // Legacy fallback — no resume uploaded yet
  const scores = {};
  for (const [key, variant] of Object.entries(VARIANT_KEYWORDS)) {
    let hits = 0;
    const total = (variant.primary.length * 2) + variant.secondary.length;
    for (const kw of variant.primary)   if (text.includes(kw)) hits += 2;
    for (const kw of variant.secondary) if (text.includes(kw)) hits += 1;
    scores[key] = total > 0 ? (hits / total) * 100 : 0;
  }
  const recommended = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const variant = VARIANT_KEYWORDS[recommended];
  const rawScore = scores[recommended];
  return {
    recommendedResume: variant.name,
    resumeReason: `Keyword match with ${variant.name} profile (${Math.round(rawScore)}%)`,
    ats_coverage: Math.min(92, Math.max(25, Math.round(rawScore))) + '%',
    missing_keywords: variant.primary.filter(kw => !text.includes(kw)).slice(0, 5),
    composites_visible,
    quantification_check,
    mod1_summary: TEMPLATE_SUMMARIES[recommended],
    mod2_skills: TEMPLATE_SKILLS[recommended],
    top_matches: variant.primary.filter(kw => text.includes(kw)).slice(0, 8),
  };
}

export { VARIANT_KEYWORDS, TEMPLATE_SUMMARIES, TEMPLATE_SKILLS };
