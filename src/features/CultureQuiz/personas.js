// Keys are the persona's two strongest axes, written in AXES order (see questions.js).
export const PERSONAS = {
  'innovation+autonomy': {
    name: 'Independent Innovator',
    tagline: 'You do your best work when you are trusted to try something new.',
    summary:
      'You want room to explore original ideas and the freedom to follow them through. Close oversight and rigid playbooks drain your energy, while ownership of a fresh problem brings out your best.',
    strengths: ['Original problem solving', 'Self-direction without needing reminders', 'Turning vague ideas into working results'],
    thrives: ['Small, product-led teams', 'Roles with ownership of a new area', 'Managers who set goals, not methods'],
    watchOut: ['Heavy approval chains and strict templates', 'Teams that expect constant status updates'],
    interviewTip: 'Prepare one story where you started something new on your own and measured the result.',
  },
  'innovation+collaboration': {
    name: 'Creative Collaborator',
    tagline: 'You generate ideas and bring people along with them.',
    summary:
      'You enjoy exploring new approaches, but you want to do it with others. Brainstorming, open feedback and shared wins motivate you more than working alone.',
    strengths: ['Facilitating ideas across teams', 'Building support for change', 'Making complex ideas easy to share'],
    thrives: ['Cross-functional product or design teams', 'Cultures that welcome feedback', 'Workshops, pilots and shared experiments'],
    watchOut: ['Isolated, heads-down roles', 'Cultures where decisions are made at the top'],
    interviewTip: 'Show how you turned a group of different opinions into one idea that shipped.',
  },
  'innovation+structure': {
    name: 'Systems Designer',
    tagline: 'You like new ideas best when they are built to last.',
    summary:
      'You are drawn to elegant, well-organised solutions. You improve how things work and then document it so others can rely on it, which makes you valuable where quality and scale matter.',
    strengths: ['Designing clear, repeatable systems', 'Improving processes without breaking them', 'Spotting edge cases early'],
    thrives: ['Platform, operations or architecture roles', 'Scaling companies that need order', 'Teams that value documentation'],
    watchOut: ['Constantly changing priorities', 'Cultures that reward speed over quality'],
    interviewTip: 'Bring an example of a process you redesigned and the time or errors it saved.',
  },
  'innovation+pace': {
    name: 'Rapid Experimenter',
    tagline: 'You learn by trying things quickly.',
    summary:
      'You prefer to test an idea this week rather than plan it for months. You are comfortable with change, shifting priorities and being wrong early in order to be right sooner.',
    strengths: ['Fast prototyping and testing', 'Comfort with uncertainty', 'Learning from results and adjusting'],
    thrives: ['Early-stage startups', 'Growth and product experimentation teams', 'Cultures that celebrate learning'],
    watchOut: ['Long approval cycles', 'Roles with fixed, repetitive routines'],
    interviewTip: 'Tell a story about an experiment you ran quickly, what you learned and what you changed.',
  },
  'autonomy+collaboration': {
    name: 'Self-Led Team Player',
    tagline: 'You work independently and share what you find.',
    summary:
      'You like to own your work, and you also care how it helps the team. You do not need close management, and you keep others informed without being asked.',
    strengths: ['Reliable ownership with open communication', 'Supporting colleagues without losing focus', 'Building trust through follow-through'],
    thrives: ['Remote or hybrid teams with clear goals', 'Cultures built on trust', 'Roles that mix solo work and teamwork'],
    watchOut: ['Micromanaged environments', 'Teams where everyone works in silos'],
    interviewTip: 'Describe a project you owned and how you kept your team in the loop.',
  },
  'autonomy+structure': {
    name: 'Disciplined Owner',
    tagline: 'You take responsibility and deliver it properly.',
    summary:
      'You want clear expectations and the space to meet them your own way. You are organised and dependable, and people trust you with important work because you finish what you start.',
    strengths: ['Planning and delivering independently', 'Attention to quality and detail', 'Managing your own time well'],
    thrives: ['Roles with defined scope and accountability', 'Established, well-run organisations', 'Managers who give clear goals and trust'],
    watchOut: ['Unclear ownership and shifting goals', 'Cultures that depend on constant meetings'],
    interviewTip: 'Use examples that show a clear goal, your plan and the result you delivered.',
  },
  'autonomy+pace': {
    name: 'Startup Navigator',
    tagline: 'You move fast and find your own way.',
    summary:
      'You like a high-tempo environment where you can make decisions without waiting. Ambiguity does not slow you down, and you would rather act and adjust than wait for perfect direction.',
    strengths: ['Making good decisions with incomplete information', 'Driving things forward without being asked', 'Adapting quickly to change'],
    thrives: ['Startups and fast-growth teams', 'Roles with broad ownership', 'Managers who give goals and get out of the way'],
    watchOut: ['Slow, layered decision-making', 'Highly formal processes'],
    interviewTip: 'Share a time you made a fast decision with limited information and what it achieved.',
  },
  'collaboration+structure': {
    name: 'Reliable Coordinator',
    tagline: 'You keep people and plans aligned.',
    summary:
      'You value clear roles and a team that works well together. You are the person who makes sure everyone knows what is happening, and who prevents small problems from becoming big ones.',
    strengths: ['Coordinating people and timelines', 'Clear communication and follow-up', 'Creating calm and consistency'],
    thrives: ['Project, programme or operations roles', 'Teams with defined roles and regular check-ins', 'Organisations that value dependability'],
    watchOut: ['Chaotic environments with unclear ownership', 'Cultures that avoid structure'],
    interviewTip: 'Use a story about aligning several people or teams to deliver on time.',
  },
  'collaboration+pace': {
    name: 'Momentum Builder',
    tagline: 'You get teams moving together.',
    summary:
      'You are energised by shared goals and visible progress. You bring people along quickly, keep the team motivated and enjoy hitting milestones together.',
    strengths: ['Rallying a team around a goal', 'Keeping energy and delivery high', 'Building quick, positive relationships'],
    thrives: ['Sales, customer success and growth teams', 'Cultures with clear targets and celebration', 'Collaborative, fast-moving workplaces'],
    watchOut: ['Slow, solitary roles', 'Cultures with little feedback or recognition'],
    interviewTip: 'Show a team result you helped achieve and your specific role in creating momentum.',
  },
  'structure+pace': {
    name: 'Precision Executor',
    tagline: 'You deliver quickly without cutting corners.',
    summary:
      'You like clear targets, defined processes and a brisk tempo. You turn plans into results efficiently and you are comfortable being measured on output.',
    strengths: ['Efficient, high-quality execution', 'Meeting deadlines consistently', 'Working well with metrics and targets'],
    thrives: ['Operations, delivery and finance roles', 'Performance-driven organisations', 'Teams with clear goals and routines'],
    watchOut: ['Vague goals and constant reinvention', 'Cultures that discourage measurement'],
    interviewTip: 'Lead with numbers: targets you were given, how you hit them and how you did it reliably.',
  },
};

export const AXIS_INSIGHTS = {
  innovation: {
    high: 'You are energised by new ideas. Look for employers that encourage experimentation and fresh approaches.',
    mid: 'You balance new ideas with proven methods. You can fit workplaces that value either.',
    low: 'You prefer tried-and-tested approaches. Look for employers that value consistency and refinement.',
  },
  autonomy: {
    high: 'You do your best work with ownership and little supervision. Look for managers who give goals, not instructions.',
    mid: 'You are comfortable with both independence and guidance, depending on the task.',
    low: 'You value clear direction and support. Look for managers who coach and give regular feedback.',
  },
  collaboration: {
    high: 'You thrive when working closely with others. Look for teams that share decisions and celebrate results together.',
    mid: 'You can work well both alone and with others, depending on the situation.',
    low: 'You prefer focused, independent work. Look for roles with clear individual responsibility.',
  },
  structure: {
    high: 'You like clarity: defined roles, processes and expectations. Look for well-organised employers.',
    mid: 'You can work with some structure and some flexibility.',
    low: 'You prefer flexibility over fixed process. Look for workplaces that let you adapt how work gets done.',
  },
  pace: {
    high: 'You enjoy speed and change. Look for fast-growing teams with frequent goals and rapid decisions.',
    mid: 'You can adapt to both fast and steady rhythms.',
    low: 'You prefer a steady rhythm with time to go deep. Look for workplaces that value depth over speed.',
  },
};
