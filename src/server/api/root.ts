import { notificationPreferenceRouter } from "~/server/api/routers/notification";
import { referralRouter } from "~/server/api/routers/referral";
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
  user: userRouter,
  screeningSession: screeningSessionRouter,
  question: questionRouter,
  answer: answerRouter,
  eligibility: eligibilityRouter,
  eligibilityResult: eligibilityResultRouter,
  notificationPreference: notificationPreferenceRouter,
  referral: referralRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
