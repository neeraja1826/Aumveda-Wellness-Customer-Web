import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import ProductGrid from "../components/products/ProductGrid";
import { getHomeHero } from "../services/homeService";
import { getProducts } from "../services/productService";
import "../styles/discovery-pages.css";

const BANNER_INTERVAL = 3800;

function isOnSale(product) {
  const price = Number(
    product?.price ?? product?.variant?.price ?? 0
  );
  const compareAtPrice = Number(
    product?.compare_at_price ??
      product?.variant?.compare_at_price ??
      0
  );

  return compareAtPrice > price;
}

function getBannerList(response) {
  const candidates = [
    response,
    response?.data,
    response?.data?.data,
    response?.banners,
  ];
  const banners = candidates.find(Array.isArray) || [];

  return banners.filter(
    banner =>
      typeof banner?.image_url === "string" &&
      banner.image_url.trim()
  );
}

export default function Deals() {
  const [products, setProducts] = useState([]);
  const [banners, setBanners] = useState([]);
  const [activeBanner, setActiveBanner] = useState(0);
  const [bannerError, setBannerError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDeals = useCallback(async () => {
    const result = await getProducts({ limit: 60 });
    const allProducts = Array.isArray(result) ? result : [];
    const discountedProducts = allProducts.filter(isOnSale);

    return discountedProducts.length > 0
      ? discountedProducts
      : allProducts.slice(0, 16);
  }, []);

  const handleLoadError = useCallback((loadError) => {
      console.error("Unable to load deals:", loadError);
      setError(loadError?.message || "Unable to load current deals.");
  }, []);

  useEffect(() => {
    let active = true;

    fetchDeals()
      .then(result => {
        if (active) setProducts(result);
      })
      .catch(loadError => {
        if (active) handleLoadError(loadError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchDeals, handleLoadError]);

  useEffect(() => {
    let active = true;

    getHomeHero()
      .then(response => {
        if (active) {
          setBanners(getBannerList(response));
        }
      })
      .catch(bannerLoadError => {
        console.warn("Unable to load deals banners:", bannerLoadError);
        if (active) setBannerError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return undefined;

    const interval = window.setInterval(() => {
      setActiveBanner(current => (current + 1) % banners.length);
    }, BANNER_INTERVAL);

    return () => window.clearInterval(interval);
  }, [banners.length]);

  function handleRetry() {
    setLoading(true);
    setError("");

    fetchDeals()
      .then(setProducts)
      .catch(handleLoadError)
      .finally(() => setLoading(false));
  }

  return (
    <main className="discovery-page">
      <div className="discovery-page__container">
        <Link className="discovery-page__back" to="/">
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <header className="discovery-page__header">
          <span className="discovery-page__eyebrow">
            <Sparkles size={15} />
            WELLNESS, FOR LESS
          </span>
          <h1>Deals of the Week</h1>
          <p>Discover special prices on your favourite wellness essentials.</p>
        </header>

        {banners.length > 0 && (
          <section className="deals-banner" aria-label="Deals banners">
            <img
              src={banners[activeBanner]?.image_url}
              alt={
                banners[activeBanner]?.alt_text ||
                banners[activeBanner]?.title ||
                "Aumveda featured deal"
              }
            />
            {banners.length > 1 && (
              <div className="deals-banner__pagination" aria-label="Choose a banner">
                {banners.map((banner, index) => (
                  <button
                    key={banner.id || index}
                    type="button"
                    aria-label={`Show banner ${index + 1}`}
                    aria-current={index === activeBanner ? "true" : undefined}
                    className={index === activeBanner ? "is-active" : ""}
                    onClick={() => setActiveBanner(index)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {bannerError && (
          <p className="discovery-page__notice" role="status">
            Promotional banners are temporarily unavailable.
          </p>
        )}

        {loading ? (
          <div className="discovery-page__state" role="status">
            <span className="discovery-page__spinner" />
            Loading current deals...
          </div>
        ) : error ? (
          <div className="discovery-page__state discovery-page__state--error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={handleRetry}
            >
              <RefreshCw size={15} />
              Try Again
            </button>
          </div>
        ) : products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <div className="discovery-page__state">
            No products are available right now.
          </div>
        )}
      </div>
    </main>
  );
}
