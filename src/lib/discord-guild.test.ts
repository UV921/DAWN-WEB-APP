import assert from "node:assert/strict";
import {
  collectGuildIds,
  parseBoardFlags,
  resolveGuildAccess,
  roleGrantsManage,
  shouldAutoRunBoardJob,
} from "./discord-guild";

const GUILD = "111111111111111111";
const OWNER = "222222222222222222";
const ADMIN = "333333333333333333";
const MOD = "444444444444444444";
const MEMBER = "555555555555555555";

const roles = [
  { id: GUILD, permissions: "0" },
  { id: "role-admin", permissions: "8" },
  { id: "role-manage", permissions: "32" },
  { id: "role-member", permissions: "1024" },
];

assert.equal(roleGrantsManage("8"), true);
assert.equal(roleGrantsManage("32"), true);
assert.equal(roleGrantsManage("40"), true);
assert.equal(roleGrantsManage("1024"), false);
assert.equal(roleGrantsManage("not-a-number"), false);

{
  const access = resolveGuildAccess({
    discordUserId: OWNER,
    ownerId: OWNER,
    guildId: GUILD,
    memberRoleIds: [],
    roles,
  });
  assert.equal(access.canManage, true);
  assert.equal(access.isOwner, true);
  assert.equal(access.reason, "owner");
}

{
  const access = resolveGuildAccess({
    discordUserId: ADMIN,
    ownerId: OWNER,
    guildId: GUILD,
    memberRoleIds: ["role-admin"],
    roles,
  });
  assert.equal(access.canManage, true);
  assert.equal(access.isOwner, false);
  assert.equal(access.reason, "administrator");
}

{
  const access = resolveGuildAccess({
    discordUserId: MOD,
    ownerId: OWNER,
    guildId: GUILD,
    memberRoleIds: ["role-manage"],
    roles,
  });
  assert.equal(access.canManage, true);
  assert.equal(access.reason, "manage_guild");
}

{
  const access = resolveGuildAccess({
    discordUserId: MEMBER,
    ownerId: OWNER,
    guildId: GUILD,
    memberRoleIds: ["role-member"],
    roles,
  });
  assert.equal(access.canManage, false);
  assert.equal(access.reason, null);
}

{
  const access = resolveGuildAccess({
    discordUserId: MEMBER,
    ownerId: OWNER,
    guildId: GUILD,
    memberRoleIds: null,
    roles,
  });
  assert.equal(access.canManage, false, "unknown member is not trusted");
}

{
  const access = resolveGuildAccess({
    discordUserId: OWNER,
    ownerId: OWNER,
    guildId: GUILD,
    memberRoleIds: null,
    roles: [],
  });
  assert.equal(access.canManage, true, "owner still works if member fetch fails");
}

assert.deepEqual(parseBoardFlags({}), {
  pingEnabled: true,
  boardEnabled: true,
  reviewEnabled: true,
  reportEnabled: true,
});
assert.equal(parseBoardFlags({ pingEnabled: false }).pingEnabled, false);
assert.equal(parseBoardFlags({ boardEnabled: false }).boardEnabled, false);

assert.equal(shouldAutoRunBoardJob(true), true);
assert.equal(shouldAutoRunBoardJob(false), false);
assert.equal(shouldAutoRunBoardJob(false, { force: true }), true);
assert.equal(shouldAutoRunBoardJob(undefined), true);

assert.deepEqual(
  collectGuildIds({
    envGuildId: GUILD,
    boardGuildIds: [GUILD, "not-an-id", "666666666666666666"],
  }),
  [GUILD, "666666666666666666"]
);

console.log("discord-guild tests passed");
