import { Router } from "express";
import { db, teamsTable, teamMembersTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { resolvePlan } from "../lib/plans";
import { assertCanAddTeamMember, PlanError, humanizeLimit } from "../lib/plan-enforcement";

const router = Router();

function planError(err: unknown, res: import("express").Response): boolean {
  if (err instanceof PlanError) {
    res.status(err.status).json({ error: err.message, upgrade: true, feature: err.feature });
    return true;
  }
  return false;
}

async function getOrCreateTeam(ownerId: number) {
  const [existing] = await db.select().from(teamsTable).where(eq(teamsTable.ownerId, ownerId));
  if (existing) return existing;
  const [created] = await db.insert(teamsTable).values({ ownerId }).onConflictDoNothing().returning();
  if (created) return created;
  const [again] = await db.select().from(teamsTable).where(eq(teamsTable.ownerId, ownerId));
  return again;
}

router.get("/me/team", requireAuth, async (req, res) => {
  const ownerId = req.session.userId!;
  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, ownerId));
  const plan = await resolvePlan(owner);
  const team = await getOrCreateTeam(ownerId);
  const members = await db.select().from(teamMembersTable).where(eq(teamMembersTable.teamId, team.id));

  res.json({
    team: { id: team.id, name: team.name },
    owner: { id: owner.id, name: owner.name, email: owner.email, role: "owner" as const, status: "active" as const },
    members,
    seatLimit: plan.teamMemberLimit,
    seatLimitLabel: humanizeLimit(plan.teamMemberLimit),
    seatsUsed: members.length + 1,
    canInvite: plan.teamMemberLimit > 1 || plan.teamMemberLimit < 0,
  });
});

router.patch("/me/team", requireAuth, async (req, res) => {
  const ownerId = req.session.userId!;
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
  const team = await getOrCreateTeam(ownerId);
  const [updated] = await db.update(teamsTable).set({ name: name.trim() }).where(eq(teamsTable.id, team.id)).returning();
  res.json(updated);
});

router.post("/me/team/members", requireAuth, async (req, res) => {
  const ownerId = req.session.userId!;
  const email = (req.body as { email?: string }).email?.toLowerCase().trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: "A valid email is required" }); return; }

  try {
    await assertCanAddTeamMember(ownerId);
  } catch (err) {
    if (planError(err, res)) return;
    throw err;
  }

  const team = await getOrCreateTeam(ownerId);
  const dup = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, team.id), eq(teamMembersTable.email, email)));
  if (dup.length) { res.status(409).json({ error: "That person is already on your team" }); return; }

  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  const [member] = await db.insert(teamMembersTable).values({
    teamId: team.id,
    email,
    userId: existingUser?.id ?? null,
    role: "member",
    status: existingUser ? "active" : "pending",
    joinedAt: existingUser ? new Date() : null,
  }).returning();
  res.status(201).json(member);
});

router.delete("/me/team/members/:id", requireAuth, async (req, res) => {
  const ownerId = req.session.userId!;
  const id = Number(req.params.id);
  const team = await getOrCreateTeam(ownerId);
  const [existing] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.id, id), eq(teamMembersTable.teamId, team.id)));
  if (!existing) { res.status(404).json({ error: "Member not found" }); return; }
  await db.delete(teamMembersTable).where(eq(teamMembersTable.id, id));
  res.status(204).send();
});

export default router;
