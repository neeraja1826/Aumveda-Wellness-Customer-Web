import api from "./api";

import {
  cachedPublicRequest,
  invalidatePublicCache,
} from "./publicRequestCache";

const HERO_TTL = 15 * 60 * 1000;
const CATEGORY_TTL = 30 * 60 * 1000;
const CMS_TTL = 60 * 1000;
const COUPONS_TTL = 30 * 1000;
const HOMEPAGE_BANNERS_TTL = 60 * 1000;

function getResponseData(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return response?.data ?? response;
}

/* ==========================================================
   HOME BANNERS
========================================================== */

export async function getHomeHero() {
  return cachedPublicRequest(
    "home:app-banners:v1",
    async () => {
      const response = await api.get("/home/app-banners");

      return getResponseData(response);
    },
    {
      ttl: HERO_TTL,
      persist: true,
    }
  );
}

export async function getWebHeroBanners() {
  return cachedPublicRequest(
    "home:web-hero-banners:v1",
    async () => {
      const response = await api.get("/home/web-hero-banners");
      return getResponseData(response);
    },
    {
      ttl: HOMEPAGE_BANNERS_TTL,
      persist: true,
    }
  );
}

export async function getMainPromoBanners() {
  return cachedPublicRequest(
    "home:main-promo-banners:v1",
    async () => {
      const response = await api.get("/home/main-promo-banners");
      return getResponseData(response);
    },
    {
      ttl: HOMEPAGE_BANNERS_TTL,
      persist: true,
    }
  );
}

/* ==========================================================
   HOME CATEGORIES
========================================================== */

export async function getHomeCategories() {
  return cachedPublicRequest(
    "categories:v1",
    async () => {
      const response = await api.get("/categories");

      return getResponseData(response);
    },
    {
      ttl: CATEGORY_TTL,
      persist: true,
    }
  );
}

/* ==========================================================
   FEATURED PRODUCTS
========================================================== */

export async function getFeaturedProducts() {
  return cachedPublicRequest(
    "home:featured-products:v1",
    async () => {
      const response = await api.get(
        "/home/featured-products"
      );

      return getResponseData(response);
    },
    {
      ttl: CMS_TTL,
      persist: false,
    }
  );
}

/* ==========================================================
   WELLNESS BUNDLES
========================================================== */

export async function getHomeBundles() {
  return cachedPublicRequest(
    "home:bundles:v1",
    async () => {
      const response = await api.get(
        "/home/bundles"
      );

      return getResponseData(response);
    },
    {
      ttl: CMS_TTL,
      persist: false,
    }
  );
}

/* ==========================================================
   COUPONS
========================================================== */

export async function getHomeCoupons(placement = "home") {
  return cachedPublicRequest(
    `home:coupons:${placement}:v1`,
    async () => {
      const response = await api.get(
        `/home/coupons?placement=${encodeURIComponent(placement)}`
      );

      return getResponseData(response);
    },
    {
      ttl: COUPONS_TTL,
      persist: false,
    }
  );
}

/* ==========================================================
   NEW ARRIVALS
========================================================== */

export async function getNewArrivals() {
  return cachedPublicRequest(
    "home:new-arrivals:v1",
    async () => {
      const response = await api.get(
        "/home/new-arrivals"
      );

      return getResponseData(response);
    },
    {
      ttl: CMS_TTL,
      persist: false,
    }
  );
}

/* ==========================================================
   CATEGORY CAMPAIGNS
========================================================== */

export async function getCategoryCampaigns() {
  return cachedPublicRequest(
    "home:category-campaigns:v1",
    async () => {
      const response = await api.get(
        "/home/category-campaigns"
      );

      return getResponseData(response);
    },
    {
      ttl: CMS_TTL,
      persist: false,
    }
  );
}

/* ==========================================================
   CATEGORY BANNERS
========================================================== */

export async function getCategoryBanners() {
  return cachedPublicRequest(
    "home:category-banners:v1",
    async () => {
      const response = await api.get(
        "/home/category-banners"
      );

      return getResponseData(response);
    },
    {
      ttl: CMS_TTL,
      persist: false,
    }
  );
}

/* ==========================================================
   CACHE INVALIDATION
========================================================== */

export function invalidateHomeCouponsCache() {
  invalidatePublicCache("home:coupons:");
}

export function invalidateHomeCache() {
  invalidatePublicCache("home:");
}

/* ==========================================================
   HOME CONFIGURATION
========================================================== */

export async function getHomeConfiguration() {
  return cachedPublicRequest(
    "home:configuration:v1",
    async () => {
      try {
        const response = await api.get(
          "/home/configuration",
          {
            params: {
              platform: "web",
              page: "home",
            },
          }
        );

        return response?.data ?? response;
      } catch (error) {
        console.error(
          "Get home configuration failed:",
          error
        );

        throw error;
      }
    },
    {
      ttl: CMS_TTL,
      persist: false,
    }
  );
}