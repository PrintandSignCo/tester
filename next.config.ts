import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "@aws-sdk/client-s3", "nodemailer"],
  experimental: {
    serverActions: {
      bodySizeLimit: "80mb",
    },
    middlewareClientMaxBodySize: "80mb",
  },
};

export default nextConfig;
