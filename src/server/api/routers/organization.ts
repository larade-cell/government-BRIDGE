import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { recordAudit } from "~/server/api/helpers/audit";
import { requireRole } from "~/server/api/helpers/session";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Community organizations residents can be referred to. Reads are public
 * (reference data, used by the referral flow); writes are admin-only and
 * audited.
 */

const addressShape = z.object({
  line1: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(60).optional(),
  postal_code: z.string().trim().max(20).optional(),
});

export const organizationRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({ service_category: z.string().trim().min(1).max(64).optional() }).optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.organizations.findMany({
        where: input?.service_category
          ? { service_categories: { has: input.service_category } }
          : undefined,
        orderBy: { name: "asc" },
      });
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organizations.findUnique({ where: { id: input.id } });
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }
      return org;
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        organization_type: z.string().trim().min(1).max(64),
        phone: z.string().trim().max(32).nullish(),
        email: z.string().trim().email().max(254).nullish(),
        website_url: z.string().url().max(500).nullish(),
        address: addressShape.optional(),
        service_categories: z.array(z.string().trim().min(1).max(64)).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      const org = await ctx.db.organizations.create({
        data: {
          name: input.name,
          organization_type: input.organization_type,
          phone: input.phone ?? null,
          email: input.email ?? null,
          website_url: input.website_url ?? null,
          ...(input.address && { address: input.address }),
          service_categories: input.service_categories,
        },
        select: { id: true },
      });
      await recordAudit(ctx, {
        action: "organization.create",
        entity_type: "organization",
        entity_id: org.id,
        after: { name: input.name, organization_type: input.organization_type },
      });
      return { id: org.id };
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(200).optional(),
        organization_type: z.string().trim().min(1).max(64).optional(),
        phone: z.string().trim().max(32).nullish(),
        email: z.string().trim().email().max(254).nullish(),
        website_url: z.string().url().max(500).nullish(),
        address: addressShape.optional(),
        service_categories: z.array(z.string().trim().min(1).max(64)).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      const existing = await ctx.db.organizations.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }
      await ctx.db.organizations.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.organization_type !== undefined && {
            organization_type: input.organization_type,
          }),
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(input.email !== undefined && { email: input.email }),
          ...(input.website_url !== undefined && { website_url: input.website_url }),
          ...(input.address !== undefined && { address: input.address }),
          ...(input.service_categories !== undefined && {
            service_categories: input.service_categories,
          }),
        },
      });
      await recordAudit(ctx, {
        action: "organization.update",
        entity_type: "organization",
        entity_id: input.id,
      });
      return { id: input.id };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      const existing = await ctx.db.organizations.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }
      // referrals.organization_id is NoAction — block deletion while referenced
      // rather than orphaning referral history.
      const referenced = await ctx.db.referrals.count({
        where: { organization_id: input.id },
      });
      if (referenced > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Can't delete: ${referenced} referral(s) point to this organization. Reassign them first.`,
        });
      }
      await ctx.db.organizations.delete({ where: { id: input.id } });
      await recordAudit(ctx, {
        action: "organization.delete",
        entity_type: "organization",
        entity_id: input.id,
      });
      return { id: input.id, deleted: true };
    }),
});
