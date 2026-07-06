import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: "postgresql://postgres:Kresko0112233+@localhost:5432/kresko_admin?schema=public",
  },
});