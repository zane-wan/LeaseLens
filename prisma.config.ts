import path from "node:path"
import { defineConfig } from "prisma/config"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

export default defineConfig({
  earlyAccess: true,
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
  migrate: {
    async adapter() {
      const { PrismaPg } = await import("@prisma/adapter-pg")
      return new PrismaPg({ connectionString: process.env.DATABASE_URL })
    },
  },
})