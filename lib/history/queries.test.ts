// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createTestDb } from "../../__tests__/_fixtures/test-db";

vi.mock("server-only", () => ({}));

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any;
let user: any;
let caseTable: any;
let laufliste: any;
let listLauflistenHistoryForUser: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

let dbCleanup: () => void;

const USER_A = "hist-u-a";
const USER_B = "hist-u-b";

beforeAll(async () => {
  const testDb = createTestDb();
  dbCleanup = testDb.cleanup;
  process.env.DATABASE_URL = testDb.dbFile;
  process.env.BETTER_AUTH_SECRET = "testsecret12345678901234567890";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  vi.resetModules();
  ({ db } = await import("@/db/client"));
  ({ user, caseTable, laufliste } = await import("@/db/schema"));
  ({ listLauflistenHistoryForUser } = await import("@/lib/history/queries"));
});

afterAll(() => {
  dbCleanup?.();
});

beforeEach(async () => {
  await db.delete(laufliste);
  await db.delete(caseTable);
  await db.delete(user);

  await db.insert(user).values([
    { id: USER_A, name: "Alice", email: "ha@x.de", emailVerified: true },
    { id: USER_B, name: "Bob", email: "hb@x.de", emailVerified: true },
  ]);
});

async function seedCase(
  caseId: string,
  userId: string,
  personName: string,
) {
  await db.insert(caseTable).values({
    id: caseId,
    userId,
    personName,
    status: "pdf_generated",
  });
}

async function seedLaufliste(
  id: string,
  caseId: string,
  userId: string,
  generatedAt: Date,
  documentCount = 2,
  fileSize = 12345,
) {
  await db.insert(laufliste).values({
    id,
    caseId,
    userId,
    pdfStoragePath: `data/laufliste/${id}.pdf`,
    generatedAt,
    documentCount,
    fileSize,
  });
}

describe("listLauflistenHistoryForUser", () => {
  it("matches by case.personName search (case-insensitive, umlaut-safe)", async () => {
    await seedCase("c-1", USER_A, "Dr. Müller Özgür");
    await seedCase("c-2", USER_A, "Max Mustermann");
    await seedCase("c-3", USER_A, "Erika Schmidt");
    await seedLaufliste("l-1", "c-1", USER_A, new Date("2026-03-01T10:00:00Z"));
    await seedLaufliste("l-2", "c-2", USER_A, new Date("2026-03-02T10:00:00Z"));
    await seedLaufliste("l-3", "c-3", USER_A, new Date("2026-03-03T10:00:00Z"));

    // Case-insensitive lowercase search.
    const byMueller = await listLauflistenHistoryForUser(USER_A, {
      search: "müller",
    });
    expect(byMueller.totalCount).toBe(1);
    expect(byMueller.items[0].personName).toContain("Müller");

    // Partial match.
    const byMuster = await listLauflistenHistoryForUser(USER_A, {
      search: "MUSTER",
    });
    expect(byMuster.totalCount).toBe(1);
    expect(byMuster.items[0].personName).toBe("Max Mustermann");

    // Different user isolated.
    const forB = await listLauflistenHistoryForUser(USER_B);
    expect(forB.totalCount).toBe(0);
  });

  it("filters by date range inclusively and orders DESC", async () => {
    await seedCase("c-10", USER_A, "Person A");
    await seedCase("c-11", USER_A, "Person B");
    await seedCase("c-12", USER_A, "Person C");
    await seedLaufliste(
      "l-10",
      "c-10",
      USER_A,
      new Date("2026-01-15T08:00:00Z"),
    );
    await seedLaufliste(
      "l-11",
      "c-11",
      USER_A,
      new Date("2026-02-15T08:00:00Z"),
    );
    await seedLaufliste(
      "l-12",
      "c-12",
      USER_A,
      new Date("2026-03-15T08:00:00Z"),
    );

    const windowed = await listLauflistenHistoryForUser(USER_A, {
      dateFrom: new Date("2026-02-01T00:00:00Z"),
      dateTo: new Date("2026-03-31T23:59:59Z"),
    });
    expect(windowed.totalCount).toBe(2);
    // Newest first.
    expect(windowed.items[0].lauflisteId).toBe("l-12");
    expect(windowed.items[1].lauflisteId).toBe("l-11");
  });

  it("paginates with totalCount reflecting pre-pagination match", async () => {
    await seedCase("p-c", USER_A, "Paginated");
    // 25 Lauflisten → page size 10 → page 3 has 5 items.
    for (let i = 0; i < 25; i++) {
      await seedLaufliste(
        `p-l-${i}`,
        "p-c",
        USER_A,
        new Date(`2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`),
      );
    }

    const page1 = await listLauflistenHistoryForUser(USER_A, {
      page: 1,
      pageSize: 10,
    });
    expect(page1.items.length).toBe(10);
    expect(page1.totalCount).toBe(25);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(10);

    const page3 = await listLauflistenHistoryForUser(USER_A, {
      page: 3,
      pageSize: 10,
    });
    expect(page3.items.length).toBe(5);
    expect(page3.totalCount).toBe(25);
  });
});
