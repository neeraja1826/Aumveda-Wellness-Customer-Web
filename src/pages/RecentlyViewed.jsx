import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock3, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import ProductGrid from "../components/products/ProductGrid";
import { useAuth } from "../context/AuthContext";
import { getRecentlyViewedProducts } from "../services/productService";
import "../styles/discovery-pages.css";

export default function RecentlyViewed() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProducts = useCallback(async () => {
    const result = await getRecentlyViewedProducts();
    const seen = new Set();

    return (Array.isArray(result) ? result : [])
      .map((item) => item?.product || item)
      .filter((product) => {
        if (!product?.id || !product?.slug || seen.has(String(product.id))) {
          return false;
        }
        seen.add(String(product.id));
        return true;
      });
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return undefined;

    let active = true;
    loadProducts()
      .then((result) => {
        if (active) {
          setProducts(result);
          setError("");
        }
      })
      .catch((loadError) => {
        console.error("Unable to load recently viewed products:", loadError);
        if (active) {
          setError(loadError?.message || "Unable to load your browsing history.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, loadProducts]);

  function handleRetry() {
    setLoading(true);
    setError("");
    loadProducts()
      .then(setProducts)
      .catch((loadError) => {
        console.error("Unable to load recently viewed products:", loadError);
        setError(loadError?.message || "Unable to load your browsing history.");
      })
      .finally(() => setLoading(false));
  }

  return (
    <main className="discovery-page">
      <div className="discovery-page__container">
        <Link className="discovery-page__back" to="/profile">
          <ArrowLeft size={16} />
          Back to Profile
        </Link>

        <header className="discovery-page__header">
          <span className="discovery-page__eyebrow">
            <Clock3 size={15} />
            YOUR SHOPPING HISTORY
          </span>
          <h1>Recently Viewed</h1>
          <p>Pick up where you left off and continue exploring.</p>
        </header>

        {authLoading ? (
          <div className="discovery-page__state" role="status">
            <span className="discovery-page__spinner" />
            Loading your recently viewed products...
          </div>
        ) : !isAuthenticated ? (
          <div className="discovery-page__state">
            <p>Sign in to view products saved to your account.</p>
            <button type="button" onClick={() => navigate("/login", {
              state: { from: { pathname: "/recently-viewed" } },
            })}>
              Sign In
            </button>
          </div>
        ) : loading ? (
          <div className="discovery-page__state" role="status">
            <span className="discovery-page__spinner" />
            Loading your recently viewed products...
          </div>
        ) : error ? (
          <div className="discovery-page__state discovery-page__state--error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={handleRetry}>
              <RefreshCw size={15} />
              Try Again
            </button>
          </div>
        ) : products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <div className="discovery-page__state">
            You have not viewed any products yet.
          </div>
        )}
      </div>
    </main>
  );
}
