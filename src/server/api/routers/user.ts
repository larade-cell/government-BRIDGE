import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [authUser, appUser] = await Promise.all([
      ctx.db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, image: true },
      }),
      ctx.db.users.findUnique({
        where: { id: userId },
        select: { id: true, role: true, preferred_language: true, phone: true },
      }),
    ]);

    return { authUser, appUser };
  }),
});
