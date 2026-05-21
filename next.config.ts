import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

/** Racine du projet (évite que Turbopack prenne ~/package-lock.json comme workspace). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Évite que Turbopack bundle Prisma sans les delegates des modèles (ex. prisma.user undefined). */
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
