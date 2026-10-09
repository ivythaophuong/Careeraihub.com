// ALL user-facing wording of the consent flow lives here, in one file, so that it can be reviewed in one place.
// PLACEHOLDER WORDING: it needs legal review before the flow is used by anyone but internal testers (design, section 2).
// Do not write "PDPA compliant" or similar: until counsel confirms, the product may only say it is designed with Singapore PDPA requirements in mind.

export const COPY = {
  shareButton: (employer) => `Share my profile with ${employer}`,
  dialogTitle: (employer) => `Share your profile with ${employer}?`,
  willSee: (employer) => `${employer} will be able to see:`,
  notShared: 'Not shared: your resume text, email address, credentials and practice scores.',
  salaryLabel: 'Also share my expected salary range',
  expiry: (date) => `This lasts until ${date}. You can stop sharing at any time.`,
  share: 'Share',
  sharing: 'Sharing…',
  cancel: 'Cancel',
  sharedUntil: (date) => `Shared until ${date}`,
  stop: 'Stop sharing',
  stopping: 'Stopping…',
  shareFailed: 'We could not confirm the share, so nothing was shared. Please try again.',
  stopFailed: 'We could not confirm that sharing stopped, so it is still shown as active. Please try again.',
  loadFailed: 'We could not load your sharing settings.',
  unavailable: 'Sharing is unavailable for this role because the employer could not be identified.',
  tabLabel: 'My sharing',
  emptyActive: 'You are not sharing your profile with anyone.',
  historyHeading: 'History',
  unknownEmployer: 'Employer (name unavailable)',
  partsProfile: 'profile',
  partsSalary: 'salary range',
};
