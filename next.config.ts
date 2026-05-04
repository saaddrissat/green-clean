import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Évite que Turbopack bundle Prisma sans les delegates des modèles (ex. prisma.user undefined). */
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
