
import {
  cloneElement,
  useEffect,
  useMemo,
  useState,
} from "react";

/* ============================================================
   AUMVEDA — HOMEPAGE COMPONENTS
============================================================ */

import HeroSection from "../components/home/HeroSection";
import ExploreWellness from "../components/home/ExploreWellness";
import ShopByNeed from "../components/home/ShopByNeed";
import BestDealsSection from "../components/home/BestDealsSection";
import FAQChatbot from "../components/chatbot/FAQChatbot";
import AvailableCoupons from "../components/home/AvailableCoupons";
import ContinueShopping from "../components/home/ContinueShopping";

import MainPromoHero from "../components/home/MainPromoHero";
import FeaturedProducts from "../components/home/FeaturedProducts";
import CategoryCampaigns from "../components/home/CategoryCampaigns";
import CategoryProductShowcase from "../components/home/CategoryProductShowcase";
import TrustBenefits from "../components/home/TrustBenefits";
import MoreDiscovery from "../components/home/MoreDiscovery";

/* ============================================================
   SERVICES
============================================================ */

import {
  getHomeConfiguration,
} from "../services/homeService";

/* ============================================================
   HOMEPAGE STYLES
============================================================ */

import "../styles/home-cms.css";

/* ============================================================
   AUMVEDA — CUSTOMER WEB HOMEPAGE

   SECTION ORDER

   01 — Hero Banner
   02 — Explore Categories
   03 — Shop by Need
   04 — Best Deals
   05 — Available Coupons
   06 — Continue Your Wellness Journey (NEW)
   07 — Daily Wellness Essentials
   08 — Featured Products
   09 — Category Campaigns
   10 — Category Product Showcase
   11 — Trust & Benefits
   12 — More Discovery

   Navbar and Footer remain in MainLayout.
   Existing CMS controls preserved.
   No Dosha section.
============================================================ */

function getSections(response) {
  const candidates = [
    response?.data?.sections,
    response?.data?.data?.sections,
    response?.sections,
  ];

  return candidates.find(Array.isArray) || [];
}

function findSection(sections, ...keys) {
  return (
    sections.find((section) => {
      const key =
        section?.section_key ||
        section?.key ||
        section?.slug ||
        "";

      return keys.includes(key);
    }) || null
  );
}

function isVisible(section) {
  return (
    section?.is_visible !== false &&
    section?.is_enabled !== false
  );
}

/* ============================================================
   MAIN HOMEPAGE
============================================================ */

export default function HomePage() {
  const [configuration, setConfiguration] =
    useState(null);

  const [configurationError, setConfigurationError] =
    useState(false);

  /* ==========================================================
     LOAD HOMEPAGE CMS
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    async function loadConfiguration() {
      try {
        const response = await getHomeConfiguration();

        if (!mounted) return;

        setConfiguration(response);
        setConfigurationError(false);
      } catch (error) {
        console.error(
          "AUMVEDA homepage configuration failed:",
          error
        );

        if (mounted) {
          setConfigurationError(true);
        }
      }
    }

    loadConfiguration();

    return () => {
      mounted = false;
    };
  }, []);

  /* ==========================================================
     CMS SECTIONS
  ========================================================== */

  const sections = useMemo(
    () => getSections(configuration),
    [configuration]
  );

  const hero = findSection(
    sections,
    "hero_banner",
    "hero"
  );

  const explore = findSection(
    sections,
    "explore_categories",
    "explore_wellness",
    "explore_ayurveda"
  );

  const shopByNeed = findSection(
    sections,
    "shop_by_need"
  );

  const bestDeals = findSection(
    sections,
    "best_deals"
  );

  const couponsSection = findSection(
    sections,
    "available_coupons",
    "coupons"
  );

  const continueShoppingSection = findSection(
    sections,
    "continue_shopping",
    "continue_wellness_journey",
    "personalized_shopping"
  );

  const mainPromo = findSection(
    sections,
    "main_promo",
    "main_promo_hero",
    "daily_wellness_essentials"
  );

  const featured = findSection(
    sections,
    "featured_products"
  );

  const campaigns = findSection(
    sections,
    "category_campaigns",
    "campaigns"
  );

  const categoryShowcase = findSection(
    sections,
    "category_product_showcase",
    "product_category"
  );

  const trust = findSection(
    sections,
    "trust_benefits"
  );

  const discovery = findSection(
    sections,
    "more_discovery"
  );

  const homeSections = [
    {
      key: "hero_banner",
      section: hero,
      defaultOrder: 1,
      content: (
        <div className="rv-slot-hero_banner">
          <HeroSection />
        </div>
      ),
    },
    {
      key: "explore_categories",
      section: explore,
      defaultOrder: 2,
      content: (
        <div className="rv-slot-explore_categories">
          <ExploreWellness section={explore} />
        </div>
      ),
    },
    {
      key: "shop_by_need",
      section: shopByNeed,
      defaultOrder: 3,
      content: (
        <div className="rv-slot-shop_by_need">
          <ShopByNeed section={shopByNeed} />
        </div>
      ),
    },
    {
      key: "best_deals",
      section: bestDeals,
      defaultOrder: 4,
      content: (
        <div className="rv-slot-best_deals">
          <BestDealsSection section={bestDeals} />
        </div>
      ),
    },
    {
      key: "available_coupons",
      section: couponsSection,
      defaultOrder: 5,
      content: (
        <div className="rv-slot-available_coupons">
          <AvailableCoupons />
        </div>
      ),
    },
    {
      key: "continue_shopping",
      section: continueShoppingSection,
      defaultOrder: 6,
      content: (
        <div className="rv-slot-continue_shopping">
          <ContinueShopping />
        </div>
      ),
    },
    {
      key: "main_promo",
      section: mainPromo,
      defaultOrder: 7,
      content: (
        <div className="rv-slot-main_promo">
          <MainPromoHero />
        </div>
      ),
    },
    {
      key: "featured_products",
      section: featured,
      defaultOrder: 8,
      content: (
        <div className="rv-slot-featured_products">
          <FeaturedProducts section={featured} />
        </div>
      ),
    },
    {
      key: "category_campaigns",
      section: campaigns,
      defaultOrder: 9,
      content: (
        <div className="rv-slot-category_campaigns">
          <CategoryCampaigns section={campaigns} />
        </div>
      ),
    },
    {
      key: "category_product_showcase",
      section: categoryShowcase,
      defaultOrder: 10,
      content: (
        <div className="rv-slot-category_product_showcase">
          <CategoryProductShowcase section={categoryShowcase} />
        </div>
      ),
    },
    {
      key: "trust_benefits",
      section: trust,
      defaultOrder: 11,
      content: (
        <div className="rv-slot-trust_benefits">
          <TrustBenefits />
        </div>
      ),
    },
    {
      key: "more_discovery",
      section: discovery,
      defaultOrder: 12,
      content: (
        <div className="rv-slot-more_discovery">
          <MoreDiscovery section={discovery} />
        </div>
      ),
    },
  ]
    .filter(({ section }) => isVisible(section))
    .sort((left, right) => {
      const leftOrder =
        left.section &&
        Number.isFinite(Number(left.section.sort_order))
          ? Number(left.section.sort_order)
          : left.defaultOrder;
      const rightOrder =
        right.section &&
        Number.isFinite(Number(right.section.sort_order))
          ? Number(right.section.sort_order)
          : right.defaultOrder;

      return leftOrder - rightOrder ||
        left.defaultOrder - right.defaultOrder;
    });

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
  <div className="aumveda-home-page">
    <div className="aumveda-home-page__container">
      {homeSections.map(({ key, content }) => (
        cloneElement(content, { key })
      ))}
    </div>

    {configurationError && null}

    {/* FAQ Chatbot */}
    <FAQChatbot />
  </div>
);
}