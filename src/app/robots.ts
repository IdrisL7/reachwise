import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/app/",
          "/api/",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/setup",
          "/unsubscribed",
          "/internal/",
        ],
      },
    ],
    sitemap: "https://www.getsignalhooks.com/sitemap.xml",
  };
}
