// Award certificates: given by a coordinator to winners, runners-up and volunteers.
export const AWARD_TYPES = {
  first: { label: 'First Place', kicker: 'Certificate of Merit', title: 'First Place', line: 'for securing First Place in' },
  second: { label: 'Second Place', kicker: 'Certificate of Merit', title: 'Second Place', line: 'for securing Second Place in' },
  third: { label: 'Third Place', kicker: 'Certificate of Merit', title: 'Third Place', line: 'for securing Third Place in' },
  winner: { label: 'Winner', kicker: 'Certificate of Merit', title: 'Winner', line: 'for winning' },
  special: { label: 'Special Mention', kicker: 'Certificate of Merit', title: 'Special Mention', line: 'for an outstanding performance in' },
  volunteer: { label: 'Volunteer', kicker: 'Certificate of Appreciation', title: 'Volunteer', line: 'for volunteering at' },
  organiser: { label: 'Organising team', kicker: 'Certificate of Appreciation', title: 'Organising Team', line: 'for organising' },
};

/** Award details stored on the certificate. `customTitle` replaces the big title, e.g. "Best Debugger". */
export function buildAward(type, customTitle) {
  const t = AWARD_TYPES[type];
  if (!t) return null;
  const title = String(customTitle || '').trim().replace(/\s+/g, ' ').slice(0, 40) || t.title;
  return { type, title, line: t.line, kicker: t.kicker };
}

export const awardKicker = (award) => AWARD_TYPES[award?.type]?.kicker || 'Certificate of Merit';
