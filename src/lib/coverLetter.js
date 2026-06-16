export function buildCoverLetterPayload({ result, company, role }) {
  return {
    company,
    role,
    variant_focus: result.recommendedResume || "",
    summary: result.mod1_summary,
  };
}
