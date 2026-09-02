import type { MetadataRoute } from "next";

/**
 * The app is private. Nothing here should appear in a search engine; the
 * public face of House of Alchemie is the Kajabi site.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
