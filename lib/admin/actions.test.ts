// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createTestDb } from "../../__tests__/_fixtures/test-db";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: "admin-u", email: "admin@x.de" },
        session: { id: "s1" },
      })),
    },
  },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let user: any;
let behoerdenState: any;
let behoerdenDocumentType: any;
let behoerdenAuthority: any;
let updateAuthorityAction: any;
let createDocumentTypeAction: any;
let updateDocumentTypeAction: any;
let auth: any;
let drizzleEq: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let dbCleanup: () => void;

beforeAll(async () => {
  const testDb = createTestDb();
  dbCleanup = testDb.cleanup;
  process.env.DATABASE_URL = testDb.dbFile;
  process.env.BETTER_AUTH_SECRET = "x".repeat(32);
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  vi.resetModules();
  ({ db } = await import("@/db/client"));
  ({
    user,
    behoerdenState,
    behoerdenDocumentType,
    behoerdenAuthority,
  } = await import("@/db/schema"));
  ({
    updateAuthorityAction,
    createDocumentTypeAction,
    updateDocumentTypeAction,
  } = await import("./actions"));
  ({ auth } = await import("@/lib/auth"));
  ({ eq: drizzleEq } = await import("drizzle-orm"));
});

afterAll(() => {
  dbCleanup?.();
});

beforeEach(async () => {
  await db.delete(behoerdenAuthority);
  await db.delete(behoerdenDocumentType);
  await db.delete(behoerdenState);
  await db.delete(user);

  await db.insert(user).values({
    id: "admin-u",
    name: "Admin",
    email: "admin@x.de",
    emailVerified: true,
  });
  await db.insert(behoerdenState).values({
    id: "bayern",
    name: "Bayern",
    hatRegierungsbezirke: false,
  });
  await db.insert(behoerdenDocumentType).values({
    id: "geburtsurkunde",
    displayName: "Geburtsurkunde",
  });
  await db.insert(behoerdenAuthority).values({
    id: "auth-1",
    stateId: "bayern",
    documentTypeId: "geburtsurkunde",
    regierungsbezirkId: null,
    name: "Standesamt München",
    address: "Ruppertstr. 11\n80466 München",
    phone: "089 233-0",
    email: null,
    website: null,
    officeHours: null,
    notes: null,
    specialRules: null,
    needsReview: false,
  });

  auth.api.getSession.mockResolvedValue({
    user: { id: "admin-u", email: "admin@x.de" },
    session: { id: "s1" },
  });
});

describe("updateAuthorityAction", () => {
  it("updates authority fields and persists", async () => {
    const res = await updateAuthorityAction("auth-1", {
      name: "Standesamt München",
      address: "Ruppertstr. 11\n80466 München",
      phone: "089 233-96000",
      email: "info@muenchen.de",
      website: "https://muenchen.de",
      officeHours: "Mo-Fr 8-12",
      notes: "Terminbuchung online",
      specialRules: null,
      needsReview: false,
    });
    expect(res.ok).toBe(true);
    const [a] = await db
      .select()
      .from(behoerdenAuthority)
      .where(drizzleEq(behoerdenAuthority.id, "auth-1"));
    expect(a.phone).toBe("089 233-96000");
    expect(a.email).toBe("info@muenchen.de");
    expect(a.website).toBe("https://muenchen.de");
    expect(a.officeHours).toBe("Mo-Fr 8-12");
  });

  it("rejects unauthenticated calls", async () => {
    auth.api.getSession.mockResolvedValueOnce(null);
    const res = await updateAuthorityAction("auth-1", {
      name: "x",
      address: "y",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("UNAUTHORIZED");
  });

  it("returns NOT_FOUND for unknown id", async () => {
    const res = await updateAuthorityAction("does-not-exist", {
      name: "x",
      address: "y",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("NOT_FOUND");
  });

  it("validation error for empty name", async () => {
    const res = await updateAuthorityAction("auth-1", {
      name: "",
      address: "y",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("VALIDATION");
  });
});

describe("createDocumentTypeAction", () => {
  it("creates a new document type with slugified id", async () => {
    const res = await createDocumentTypeAction({
      displayName: "Arbeitszeugnis",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("arbeitszeugnis");
      expect(res.data.displayName).toBe("Arbeitszeugnis");
    }
    const rows = await db.select().from(behoerdenDocumentType);
    expect(rows.length).toBe(2);
  });

  it("returns DUPLICATE for a slug collision", async () => {
    const res = await createDocumentTypeAction({
      displayName: "Geburtsurkunde",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("DUPLICATE");
  });
});

describe("updateDocumentTypeAction", () => {
  it("updates displayName but preserves slug/id", async () => {
    const res = await updateDocumentTypeAction("geburtsurkunde", {
      displayName: "Geburtsurkunde (DE)",
    });
    expect(res.ok).toBe(true);
    const [row] = await db
      .select()
      .from(behoerdenDocumentType)
      .where(drizzleEq(behoerdenDocumentType.id, "geburtsurkunde"));
    expect(row.id).toBe("geburtsurkunde"); // slug preserved
    expect(row.displayName).toBe("Geburtsurkunde (DE)");
  });

  it("returns NOT_FOUND for missing id", async () => {
    const res = await updateDocumentTypeAction("foo", { displayName: "Foo" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("NOT_FOUND");
  });
});
