import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./lib/db/schema.ts", "./lib/db/images.ts"],
  out: "./drizzle",
});
