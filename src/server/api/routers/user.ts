import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const { id: authUserId, appUserId } = ctx.session.user;

    const [authUser, appUser] = await Promise.all([
      ctx.db.user.findUnique({
        where: { id: authUserId },
        select: { id: true, name: true, email: true, image: true },
      }),
      appUserId
        ? ctx.db.users.findUnique({
            where: { id: appUserId },
            select: {
              id: true,
              role: true,
              preferred_language: true,
              phone: true,
            },
          })
        : null,
    ]);

    return { authUser, appUser };
  }),
});
