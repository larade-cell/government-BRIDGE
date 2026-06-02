import { aiRouter } from "~/server/api/routers/ai";
import { auditRouter } from "~/server/api/routers/audit";
import { caseNoteRouter, caseRouter } from "~/server/api/routers/case";
import {
  documentChecklistRouter,
  documentUploadRouter,
} from "~/server/api/routers/document";
import { eligibilityRuleRouter } from "~/server/api/routers/eligibilityRule";
import { knowledgeRouter } from "~/server/api/routers/knowledge";
import { notificationPreferenceRouter } from "~/server/api/routers/notification";
import { organizationRouter } from "~/server/api/routers/organization";
import {
  documentTypeRouter,
  programRouter,
} from "~/server/api/routers/program";
import { referralRouter } from "~/server/api/routers/referral";
import { reportRouter } from "~/server/api/routers/report";
import {
  answerRouter,
  eligibilityResultRouter,
  eligibilityRouter,
  questionRouter,
  screeningSessionRouter,
} from "~/server/api/routers/screening";
import { userRouter } from "~/server/api/routers/user";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * Primary tRPC router. Each entry below corresponds to a section of
 * `api-routes.md`; keep them in sync as new procedures land.
 */
export const appRouter = createTRPCRouter({
  // Phase 1 — screening core
  user: userRouter,
  screeningSession: screeningSessionRouter,
  question: questionRouter,
  answer: answerRouter,
  eligibility: eligibilityRouter,
  eligibilityResult: eligibilityResultRouter,
  // Phase 2 — programs catalog, checklist, uploads
  program: programRouter,
  documentType: documentTypeRouter,
  documentChecklist: documentChecklistRouter,
  documentUpload: documentUploadRouter,
  // Phase 3 — profile, notifications, referrals
  notificationPreference: notificationPreferenceRouter,
  referral: referralRouter,
  organization: organizationRouter,
  // Phase 4 — AI, reports, cases, rule versioning
  ai: aiRouter,
  report: reportRouter,
  case: caseRouter,
  caseNote: caseNoteRouter,
  eligibilityRule: eligibilityRuleRouter,
  knowledge: knowledgeRouter,
  audit: auditRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
