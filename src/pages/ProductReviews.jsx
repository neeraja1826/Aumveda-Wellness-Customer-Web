import { useEffect, useState } from "react";
import { ArrowLeft, Star } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { getProductBySlug } from "../services/productService";
import { getProductReviews } from "../services/reviewService";
import "../styles/product-reviews.css";

export default function ProductReviews() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [retryCount, setRetryCount] = useState(0);
  const [pageData, setPageData] = useState({
    slug: "",
    product: null,
    reviews: [],
    error: "",
  });

  useEffect(() => {
    let active = true;

    async function loadProductReviews() {
      try {
        const product = await getProductBySlug(slug);
        if (!product?.id) {
          throw new Error("This product could not be found.");
        }

        const reviews = await getProductReviews(product.id);
        if (active) {
          setPageData({
            slug,
            product,
            reviews,
            error: "",
          });
        }
      } catch (loadError) {
        if (active) {
          setPageData({
            slug,
            product: null,
            reviews: [],
            error: loadError?.message || "Unable to load reviews.",
          });
        }
      }
    }

    loadProductReviews();

    return () => {
      active = false;
    };
  }, [slug, retryCount]);

  const isLoading = pageData.slug !== slug;
  const product = isLoading ? null : pageData.product;
  const reviews = isLoading ? [] : pageData.reviews;
  const error = isLoading ? "" : pageData.error;

  return (
    <main className="product-reviews-page">
      <button
        className="product-reviews-back"
        type="button"
        onClick={() => navigate(`/products/${encodeURIComponent(slug || "")}`)}
      >
        <ArrowLeft size={17} />
        Back to product
      </button>

      {isLoading ? (
        <p className="product-reviews-state" role="status">
          Loading reviews...
        </p>
      ) : error ? (
        <div className="product-reviews-state product-reviews-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <header className="product-reviews-header">
            <p>SHARE YOUR EXPERIENCE</p>
            <h1>Reviews for {product.name}</h1>
            <span>
              {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </span>
          </header>

          {reviews.length === 0 ? (
            <p className="product-reviews-state">
              No reviews yet for this product.
            </p>
          ) : (
            <div className="product-reviews-all-list">
              {reviews.map((review) => (
                <article className="product-reviews-all-card" key={review.id}>
                  <div className="product-reviews-all-card-heading">
                    <div
                      className="product-reviews-stars"
                      role="img"
                      aria-label={`${review.rating} out of 5 stars`}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={15}
                          fill={star <= Number(review.rating) ? "currentColor" : "none"}
                        />
                      ))}
                    </div>
                    {review.created_at && (
                      <time dateTime={review.created_at}>
                        {new Date(review.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </time>
                    )}
                  </div>
                  {review.title && <h2>{review.title}</h2>}
                  {review.review_text && <p>{review.review_text}</p>}
                  {review.image_url && (
                    <img
                      src={review.image_url}
                      alt="Customer review"
                      loading="lazy"
                    />
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
