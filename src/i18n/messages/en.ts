/**
 * English message catalog — the source-of-truth shape. `es.ts` must match this
 * structure (enforced via the `Messages` type). Placeholders like `{n}` are
 * interpolated by callers with a small replace.
 *
 * Scope is resident-facing only (home, auth, screening, results, account); the
 * admin console intentionally stays in English.
 */
export const en = {
  common: {
    signIn: "Sign in",
    signOut: "Sign out",
    dashboard: "Dashboard",
    back: "Back",
    saving: "Saving…",
    loading: "Loading…",
    skipToContent: "Skip to main content",
  },
  gov: {
    official: "An official benefits screening platform",
    secure:
      "Your information is private and secure. We never ask for a Social Security number.",
    howYouKnow: "Here's how you know",
    dotGovHeading: "Official websites use .gov",
    dotGovBody:
      "A .gov website belongs to an official government organization in the United States.",
    httpsHeading: "Secure .gov websites use HTTPS",
    httpsBody:
      "A lock or https:// means you've safely connected to the .gov website. Share sensitive information only on official, secure websites.",
  },
  footer: {
    agency: "U.S. Department of Labor",
    official: "An official website of the U.S. Department of Labor",
    requiredHeading: "Required federal links",
    about: "About DOL",
    accessibility: "Accessibility statement",
    foia: "FOIA requests",
    noFear: "No FEAR Act data",
    oig: "Office of Inspector General",
    performance: "Performance reports",
    privacy: "Privacy policy",
    notices: "Important website notices",
    usagov: "USA.gov",
    votegov: "Vote.gov",
  },
  nav: {
    overview: "Overview",
    documents: "Documents",
    messages: "Messages",
    profile: "Profile",
  },
  chat: {
    launch: "Ask about eligibility",
    title: "Eligibility assistant",
    intro:
      "Hi! Ask me anything about benefit programs and eligibility — I'll point you to official sources.",
    placeholder: "Ask a question…",
    send: "Send",
    sources: "Sources",
    disclaimer:
      "AI assistant — general information, not an official eligibility decision.",
    handoff: "Talk to a person",
    handoffIntro: "Share your contact info and a caseworker will reach out:",
    handoffSubmit: "Request a caseworker",
    handoffDone: "Thanks — a caseworker will follow up.",
    error: "Sorry, something went wrong. Please try again.",
    close: "Close",
  },
  home: {
    badge: "Benefits Resource Intelligence & Digital Guidance Engine",
    title: "Find the benefits you qualify for",
    subtitle:
      "BRIDGE screens you across federal and state programs in minutes — then helps you gather documents and apply.",
    signedInAs: "Signed in as",
    startScreening: "Start screening",
    goToDashboard: "Go to my dashboard",
    staffSignIn: "Staff sign-in",
    screenerNote: "Takes about 10 minutes. No account needed to begin.",
    trustFree: "Free to use",
    trustPrivate: "Private & secure",
    trustBilingual: "English & Spanish",
    featureTitle: "You don't have to figure it out alone",
    featureLead:
      "BRIDGE turns a confusing maze of programs into a few plain questions — and stays with you from screening all the way to application.",
    step1Title: "Answer a few questions",
    step1Desc:
      "Plain-language questions about your household. No jargon, and no account needed to start.",
    step2Title: "See your matches",
    step2Desc:
      "Get a personalized list of programs you likely qualify for, sorted by how well you fit.",
    step3Title: "Gather documents & apply",
    step3Desc:
      "We show you exactly which documents you need and link you straight to each application.",
    categoriesTitle: "Explore common categories",
    categoriesLead: "Jump straight to the kind of help you need most.",
    catFood: "Food & nutrition",
    catFoodDesc: "SNAP, WIC, school meals and more.",
    catHealth: "Health coverage",
    catHealthDesc: "Medicaid, CHIP and marketplace help.",
    catHousing: "Housing & utilities",
    catHousingDesc: "Rental assistance, vouchers and energy aid.",
    howCanWeHelp: "How can we help you today?",
    helpLead: "Choose where you'd like to start.",
    checkTitle: "Check what you qualify for",
    checkDesc:
      "Answer a few plain-language questions to see programs you may be eligible for.",
    continueTitle: "Continue an application",
    continueDesc:
      "Sign in with a secure link to pick up where you left off and manage documents.",
    helpTitle: "Get help in your language",
    helpDesc:
      "Use the assistant or request a caseworker. Available in English and Spanish.",
    programsTitle: "Programs we screen for",
    programsLead:
      "One questionnaire checks your eligibility across all of these at once.",
  },
  auth: {
    signInTitle: "Sign in",
    staffTitle: "Staff sign-in",
    signInSubtitle:
      "We'll email you a one-time sign-in link — no password needed.",
    staffSubtitle: "Use your staff email. We'll send a one-time sign-in link.",
    name: "Name",
    namePlaceholder: "Your name",
    email: "Email",
    sendLink: "Send magic link",
    toStaff: "Staff member? Sign in here",
    toResident: "Not staff? Resident sign-in",
    errorRequestNew: "Request a new link",
    errorGoHome: "Go home",
  },
  screening: {
    questionCounter: "Question {n} of {total}",
    yes: "Yes",
    no: "No",
    validationRequired: "Please answer this question to continue.",
    next: "Next",
    seeResults: "See results",
    noQuestions: "No questions configured.",
  },
  results: {
    title: "Your results",
    subtitle:
      "Based on your answers, here are the programs you may qualify for. These are estimates only — final eligibility is determined by the agency that runs each program.",
    noMatch:
      "No programs matched. Try adjusting your answers or browse all programs.",
    nextSteps: "Next steps",
    openApplication: "Open the {program} application",
    opensNewTab: "(opens in a new tab)",
    adjustedFor: "Adjusted for {state}",
    adjustedFallback: "State-specific rules were applied.",
    backHome: "Back to home",
    tabLikely: "Likely eligible",
    tabMaybe: "May be eligible",
    tabUnlikely: "Unlikely eligible",
    tabEmpty: "No programs in this category.",
    outcomes: {
      likely_eligible: {
        label: "Likely eligible",
        help: "Your answers meet this program's screening criteria. Final eligibility is confirmed when you apply.",
      },
      may_be_eligible: {
        label: "May be eligible",
        help: "You may qualify — some answers are borderline or missing. It's worth applying.",
      },
      needs_more_info: {
        label: "Needs more information",
        help: "We need a little more information to estimate eligibility for this program.",
      },
      unlikely_eligible: {
        label: "Unlikely eligible",
        help: "Your answers suggest you probably don't meet this program's criteria right now.",
      },
    },
    help: {
      title: "Need help applying?",
      body: "Request a caseworker to review your results and help you apply. Add a note if there's anything they should know.",
      placeholder: "Optional: tell us how we can help…",
      button: "Request help",
      requesting: "Requesting…",
      name: "Your name",
      email: "Email",
      phone: "Phone (optional)",
      contactHint:
        "Share at least one way to reach you so a caseworker can follow up.",
      doneNew:
        "Thanks — a caseworker will review your screening and follow up.",
      doneAlready:
        "You've already requested help — a caseworker will be in touch.",
    },
    explainer: {
      button: "Explain my result with AI",
      title: "AI suggestions",
      about:
        "This explanation is AI-generated from your screening result. It is general information, not an official eligibility decision.",
      loading: "Generating a plain-language explanation…",
      errorBody:
        "We couldn't generate an AI explanation right now. Your results above are still accurate.",
      tryAgain: "Try again",
      whatMattered: "What mattered",
      suggestedNextSteps: "Suggested next steps",
      aiGenerated: "AI-generated",
      standard: "Standard explanation",
    },
  },
  account: {
    welcome: "Welcome",
    welcomeNamed: "Welcome, {name}",
    subtitle:
      "Track your benefit screenings, results, and documents in one place.",
    startNewScreening: "Start new screening",
    resumeTitle: "Pick up where you left off",
    resumeDescOne: "You have {n} screening in progress.",
    resumeDescMany: "You have {n} screenings in progress.",
    startedOn: "Started {date}",
    answersSoFar: "{n} answers so far",
    resume: "Resume",
    yourScreenings: "Your screenings",
    statScreenings: "Screenings",
    statMatches: "Program matches",
    updatesTitle: "Updates",
    updatesEmpty: "No updates yet. We'll let you know when something changes.",
    referralsTitle: "Your referrals",
    referralsLead:
      "Connections your caseworker is making to local organizations.",
    referralsEmpty:
      "No referrals yet. Your caseworker will add them here as they connect you with help.",
    refStatusDraft: "Being prepared",
    refStatusSent: "Sent",
    refStatusAccepted: "Accepted",
    refStatusClosed: "Closed",
    refUnassigned: "Choosing an organization",
    messagesTitle: "Messages",
    messagesLead: "Chat directly with your caseworker.",
    messagesEmpty:
      "No messages yet. Send the first one and your caseworker will reply here.",
    messagesNoCase:
      "You don't have a caseworker yet. Request help from your results to start a conversation.",
    messagesPlaceholder: "Write a message to your caseworker…",
    messagesSend: "Send",
    messagesSending: "Sending…",
    messageFromYou: "You",
    messageFromCaseworker: "Caseworker",
    messagesWith: "Conversation with {name}",
    messagesWithUnassigned: "A caseworker will be assigned soon",
    referralAccepted:
      "Good news — {org} accepted your referral for {need}. They'll be in touch about next steps.",
    referralAcceptedNoOrg:
      "Good news — your referral for {need} was accepted. They'll be in touch about next steps.",
    caseworkerMessage: "New message from your caseworker: “{preview}”",
    updatesView: "View",
    newScreening: "New screening",
    noScreenings: "You haven't started a screening yet.",
    startOne: "Start one now",
    screeningOn: "Screening · {date}",
    completed: "Completed",
    inProgress: "In progress",
    programsMatched: "{n} programs matched",
    viewResults: "View results",
    documentsTitle: "Your documents",
    completeToSeeDocs:
      "Complete a screening to see which documents you'll need and upload them here.",
    profileTitle: "Profile & preferences",
    accountDetails: "Account details",
    managePreferences: "Manage your preferences",
    preferredLanguage: "Preferred language",
    phoneOptional: "Phone (optional)",
    saveChanges: "Save changes",
    saved: "Your changes were saved.",
    emailUpdates: "Email me updates",
    emailUpdatesDesc:
      "Get notified at {email} when there's news about your benefits.",
    on: "On",
    off: "Off",
    docs: {
      requiredTitle: "Required documents",
      requiredDesc: "Based on the programs you matched.",
      refresh: "Refresh checklist",
      refreshing: "Refreshing…",
      none: "No specific documents required yet. You can still upload anything you have below.",
      uploadTitle: "Upload a document",
      docTypeOptional: "Document type (optional)",
      accepted: "Accepted: JPG, PNG, PDF, HEIC.",
      add: "Add",
      adding: "Adding…",
      remove: "Remove",
      removeConfirmTitle: "Remove this document?",
      removeConfirmDesc: '"{file}" will be removed from your documents.',
      statusVerified: "verified",
      statusUploaded: "pending review",
      statusMissing: "missing",
      statusInvalid: "not valid",
      statusNeedsReview: "needs review",
      reupload: "Re-upload",
      otherProgram: "Other documents",
      programReady: "{done}/{total} ready",
      tabLikely: "Likely eligible",
      tabMaybe: "May be eligible",
      tabUnlikely: "Unlikely eligible",
      tabEmpty: "No programs in this category.",
      uploadDoc: "Upload",
      alsoCounts: "Also counts for: {programs}",
      sharedAcross: "Shared across {count} programs",
    },
    dangerZone: "Delete account",
    deleteWarning:
      "Permanently delete your account, screenings, results, documents, and help requests. This can't be undone.",
    deleteButton: "Delete my account",
    deleteConfirmTitle: "Delete your account?",
    deleteConfirmDesc:
      "This permanently removes your profile and all your screening data, and signs you out. This cannot be undone.",
    deleting: "Deleting…",
  },
};

export type Messages = typeof en;
