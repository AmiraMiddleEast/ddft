import { relations, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// ======== Phase 2: Document Upload & AI Extraction (D-16) ========

export const EXTRACTION_STATUS = ["pending", "extracting", "done", "error"] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUS)[number];

export const CONFIDENCE = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

export const FIELD_NAMES = [
  "dokumenten_typ",
  "ausstellende_behoerde",
  "ausstellungsort",
  "bundesland",
  "ausstellungsdatum",
  "voller_name",
] as const;
export type FieldName = (typeof FIELD_NAMES)[number];

export const document = sqliteTable(
  "document",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    mime: text("mime").notNull().default("application/pdf"),
    storagePath: text("storage_path").notNull(),
    uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    extractedAt: integer("extracted_at", { mode: "timestamp_ms" }),
    extractionStatus: text("extraction_status", { enum: EXTRACTION_STATUS })
      .notNull()
      .default("pending"),
    errorCode: text("error_code"),
  },
  (t) => [
    uniqueIndex("document_user_sha_uniq").on(t.userId, t.sha256),
    index("document_user_idx").on(t.userId),
    index("document_uploaded_at_idx").on(t.uploadedAt),
    check(
      "document_status_ck",
      sql`${t.extractionStatus} IN ('pending','extracting','done','error')`,
    ),
  ],
);

export const extraction = sqliteTable(
  "extraction",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    fieldName: text("field_name", { enum: FIELD_NAMES }).notNull(),
    fieldValue: text("field_value"),
    confidence: text("confidence", { enum: CONFIDENCE }).notNull(),
    reasoning: text("reasoning"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (t) => [
    uniqueIndex("extraction_doc_field_uniq").on(t.documentId, t.fieldName),
    index("extraction_doc_idx").on(t.documentId),
    check(
      "extraction_confidence_ck",
      sql`${t.confidence} IN ('high','medium','low')`,
    ),
    check(
      "extraction_field_ck",
      sql`${t.fieldName} IN ('dokumenten_typ','ausstellende_behoerde','ausstellungsort','bundesland','ausstellungsdatum','voller_name')`,
    ),
  ],
);

export const extractionLog = sqliteTable(
  "extraction_log",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    costEur: real("cost_eur").notNull(),
    claudeModel: text("claude_model").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (t) => [index("extraction_log_doc_idx").on(t.documentId)],
);

export const documentRelations = relations(document, ({ one, many }) => ({
  user: one(user, { fields: [document.userId], references: [user.id] }),
  extractions: many(extraction),
  logs: many(extractionLog),
}));

export const extractionRelations = relations(extraction, ({ one }) => ({
  document: one(document, {
    fields: [extraction.documentId],
    references: [document.id],
  }),
}));

export const extractionLogRelations = relations(extractionLog, ({ one }) => ({
  document: one(document, {
    fields: [extractionLog.documentId],
    references: [document.id],
  }),
}));
