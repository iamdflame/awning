import { describe, expect, it } from "vitest";
import { pgUrl } from "@/lib/db/client";

describe("pgUrl", () => {
  it("drops marketplace hints postgres.js would send to the server, keeps sslmode", () => {
    const u = pgUrl("postgres://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x&pgbouncer=true");
    expect(u).toBe("postgres://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require");
  });
});
