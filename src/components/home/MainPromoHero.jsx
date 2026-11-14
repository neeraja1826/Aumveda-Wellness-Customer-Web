
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Leaf,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { getMainPromoBanners } from "../../services/homeService";

import "../../styles/main-promo-hero.css";

/* ============================================================
   AUMVEDA — DAILY WELLNESS ESSENTIALS

   - Premium compact promotional banner
   - Admin-managed promotional copy and imagery
   - Text and CTA on the left
   - Product photography on the right
   - Responsive desktop and mobile
   - Graceful image failure fallback
============================================================ */

const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL ||
  "https://ihjbssbqwknyyzoewrik.supabase.co"
).replace(/\/+$/, "");

const STORAGE_BUCKET = "site_assets";
const STORAGE_FOLDER = "main-promo-banner";
const BANNER_FILENAME = "daily-wellness-essentials.webp";

const BANNER_URL =
  `${SUPABASE_URL}/storage/v1/object/public/` +
  `${encodeURIComponent(STORAGE_BUCKET)}/` +
  `${encodeURIComponent(STORAGE_FOLDER)}/` +
  encodeURIComponent(BANNER_FILENAME);

function getBannerList(response) {
  const candidates = [
    response?.data,
    response?.data?.data,
    response?.data?.items,
    response?.items,
  ];

  return candidates.find(Array.isArray) || [];
}

function safeInternalRoute(value, fallback) {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }

  return fallback;
}

export default function MainPromoHero() {
  const [banner, setBanner] = useState(null);
  const [failedImages, setFailedImages] = useState({
    bannerId: null,
    sources: [],
  });

  useEffect(() => {
    let active = true;

    getMainPromoBanners()
      .then((response) => {
        if (active) {
          setBanner(getBannerList(response)[0] || null);
        }
      })
      .catch((error) => {
        console.error(
          "Daily Wellness banner request failed:",
          error
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const metadata = banner?.metadata || {};
  const customCopy = metadata.custom_copy === true;
  const title = customCopy
    ? banner?.title || "Daily Wellness"
    : "Daily Wellness";
  const titleLine2 = customCopy
    ? metadata.heading_line2 || ""
    : "Essentials";
  const subtitle = customCopy
    ? banner?.subtitle || ""
    : "Natural solutions for a better tomorrow.";
  const eyebrow = customCopy
    ? metadata.eyebrow || ""
    : "THE AUMVEDA COLLECTION";
  const ctaText = customCopy
    ? metadata.primary_cta_text || "Shop Now"
    : "Shop Now";
  const imageSources = [
    banner?.image_url,
    BANNER_URL,
  ].filter(
    (source, index, sources) =>
      typeof source === "string" &&
      source.trim() &&
      sources.indexOf(source) === index &&
      !(
        failedImages.bannerId === banner?.id &&
        failedImages.sources.includes(source)
      )
  );
  const activeImage = imageSources[0];

  return (
    <section
      className="main-promo-hero"
      aria-labelledby="daily-wellness-title"
    >
      <div className="main-promo-hero__container">
        <div className="main-promo-hero__banner">

          {/* SUPABASE PROMOTIONAL IMAGE */}

          {activeImage && (
            <img
              className="main-promo-hero__image"
              src={activeImage}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => {
                setFailedImages((previous) => {
                  const sources =
                    previous.bannerId === banner?.id
                      ? previous.sources
                      : [];
                  return sources.includes(activeImage)
                    ? previous
                    : {
                        bannerId: banner?.id,
                        sources: [...sources, activeImage],
                      };
                });
                console.error(
                  "Daily Wellness banner failed:",
                  activeImage
                );
              }}
            />
          )}

          {/* READABILITY GRADIENT */}

          <div
            className="main-promo-hero__overlay"
            aria-hidden="true"
          />

          {/* PROMOTIONAL TEXT */}

          <div className="main-promo-hero__copy">

            <span className="main-promo-hero__eyebrow">
              <Sparkles
                size={13}
                aria-hidden="true"
              />
              {eyebrow}
            </span>

            <h2 id="daily-wellness-title">
              {title}
              {titleLine2 && <span>{titleLine2}</span>}
            </h2>

            <p className="main-promo-hero__subtitle">
              {subtitle}
            </p>

            <Link
              to={safeInternalRoute(
                banner?.target_url,
                "/products"
              )}
              className="main-promo-hero__shop"
            >
              {ctaText}
              <ArrowRight
                size={16}
                aria-hidden="true"
              />
            </Link>

            <div className="main-promo-hero__benefits">
              <span>
                <Leaf
                  size={14}
                  aria-hidden="true"
                />
                {customCopy
                  ? metadata.benefit_one || ""
                  : "Natural Ingredients"}
              </span>

              <span>
                <ShieldCheck
                  size={14}
                  aria-hidden="true"
                />
                {customCopy
                  ? metadata.benefit_two || ""
                  : "Quality Assured"}
              </span>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
