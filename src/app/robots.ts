import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app/", "/api/", "/internal/", "/setup/"],
      },
    ],
    sitemap: "https://www.getsignalhooks.com/sitemap.xml",
  };
}
