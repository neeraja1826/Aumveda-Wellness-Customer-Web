
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import "../../styles/more-discovery.css";

/* ============================================================
   AUMVEDA — MORE DISCOVERY

   - Four promotional banners
   - Existing Supabase Storage images
   - Dedicated left promotional text
   - Product photography cropped on right
   - Fully clickable cards
   - Mobile horizontal swipe
   - No product API requests
============================================================ */

const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL ||
  "https://ihjbssbqwknyyzoewrik.supabase.co"
).replace(/\/+$/, "");

const STORAGE_BUCKET = "site_assets";
const STORAGE_FOLDER = "more discovery";

function getStorageImage(fileName) {
  if (!SUPABASE_URL || !fileName) {
    return "";
  }

  return (
    `${SUPABASE_URL}/storage/v1/object/public/` +
    `${encodeURIComponent(STORAGE_BUCKET)}/` +
    `${encodeURIComponent(STORAGE_FOLDER)}/` +
    encodeURIComponent(fileName)
  );
}

const DISCOVERY_CARDS = [
  {
    id: "new-arrivals",
    title: "New Arrivals",
    subtitle: "Fresh wellness essentials",
    image: "hero-hair-green-4k.webp",
    destination: "/products?search=new",
    theme: "green",
  },
  {
    id: "travel-essentials",
    title: "Travel Essentials",
    subtitle: "Wellness on the go",
    image: "hero-wellness-gold-4k.webp",
    destination: "/products?search=travel",
    theme: "peach",
  },
  {
    id: "gift-sets",
    title: "Gift Sets",
    subtitle: "Perfect for loved ones",
    image: "hero-skin-rose-4k.webp",
    destination: "/products?search=gift",
    theme: "pink",
  },
  {
    id: "seasonal-picks",
    title: "Seasonal Picks",
    subtitle: "Curated for every season",
    image: "hero-calm-lavender-4k.webp",
    destination: "/products?search=seasonal",
    theme: "blue",
  },
];

function DiscoveryCard({ card }) {
  const [imageFailed, setImageFailed] = useState(false);

  const imageUrl =
    card.imageUrl || getStorageImage(card.image);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <Link
      to={card.destination}
      className={
        `more-discovery__card ` +
        `more-discovery__card--${card.theme}`
      }
      aria-label={`Shop ${card.title}`}
    >
      {/* PRODUCT PHOTOGRAPHY */}

      <div
        className="more-discovery__visual"
        aria-hidden="true"
      >
        {imageUrl && !imageFailed && (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => {
              setImageFailed(true);
              console.error(
                "More Discovery image failed:",
                imageUrl
              );
            }}
          />
        )}
      </div>

      {/* IMAGE BLENDING OVERLAY */}

      <span
        className="more-discovery__shade"
        aria-hidden="true"
      />

      {/* PROMOTIONAL CONTENT */}

      <div className="more-discovery__content">
        <h3>{card.title}</h3>

        <p>{card.subtitle}</p>

        <span className="more-discovery__button">
          Shop Now

          <ArrowRight
            size={13}
            strokeWidth={2}
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}

export default function MoreDiscovery({ section }) {
  const cmsItems = Array.isArray(section?.items)
    ? [...section.items]
        .filter((item) => item?.is_visible !== false)
        .sort(
          (left, right) =>
            Number(left.sort_order || 0) -
            Number(right.sort_order || 0)
        )
    : [];
  const usedCardIds = new Set();
  const configuredCards = cmsItems
    .slice(0, 4)
    .map((item, index) => {
      const cardId =
        item.item_key ||
        item.metadata?.card_key;
      const defaultCard =
        DISCOVERY_CARDS.find(
          (card) => card.id === cardId
        ) || DISCOVERY_CARDS[index];

      if (!defaultCard || usedCardIds.has(defaultCard.id)) {
        return null;
      }

      usedCardIds.add(defaultCard.id);
      return {
        ...defaultCard,
        title: item.title || defaultCard.title,
        subtitle: item.subtitle || defaultCard.subtitle,
        imageUrl: item.image_url || "",
      };
    })
    .filter(Boolean);
  const cards = [
    ...configuredCards,
    ...DISCOVERY_CARDS.filter(
      (card) => !usedCardIds.has(card.id)
    ),
  ];

  return (
    <section
      className="more-discovery"
      aria-label="Explore more AUMVEDA collections"
    >
      <div className="more-discovery__container">
        <div className="more-discovery__grid">
          {cards.map((card) => (
            <DiscoveryCard
              key={card.id}
              card={card}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
