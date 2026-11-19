import { useEffect, useState } from "react";
import { CheckCircle2, TicketPercent, X } from "lucide-react";

import {
  getAvailableCustomerCoupons,
  validateCustomerCoupon
} from "../../services/orderService";
import {
  clearAppliedCoupon,
  saveAppliedCoupon
} from "../../services/appliedCouponStorage";

import "../../styles/coupon-application.css";

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export default function CouponApplication({
  placement,
  subtotal,
  coupon,
  onChange,
  variantId,
  quantity,
  contextKey,
  persist = true
}) {
  const [coupons, setCoupons] = useState([]);
  const [enteredCode, setEnteredCode] = useState(null);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const code = enteredCode ?? coupon?.code ?? "";

  useEffect(() => {
    let active = true;

    getAvailableCustomerCoupons({
      placement,
      variantId,
      quantity
    })
      .then((availableCoupons) => {
        if (active) setCoupons(availableCoupons);
      })
      .catch((loadError) => {
        if (!active) return;
        console.error("Unable to load available coupons:", loadError);
        setError("Unable to load available coupons right now.");
      })
      .finally(() => {
        if (active) setLoadingCoupons(false);
      });

    return () => {
      active = false;
    };
  }, [placement, variantId, quantity, contextKey]);

  useEffect(() => {
    if (!coupon?.applied || !coupon.code) return undefined;

    let active = true;
    const appliedPlacement = coupon.placement || placement;

    validateCustomerCoupon({
      code: coupon.code,
      placement: appliedPlacement,
      variantId,
      quantity
    })
      .then((quote) => {
        if (!active) return;
        const updatedCoupon = {
          ...quote,
          placement: appliedPlacement,
          applied: true
        };
        if (persist) saveAppliedCoupon(updatedCoupon);
        onChange(updatedCoupon);
        setError("");
      })
      .catch((validationError) => {
        if (!active) return;
        if (persist) clearAppliedCoupon();
        onChange(null);
        setError(validationError?.message || "This coupon is no longer valid.");
      });

    return () => {
      active = false;
    };
  }, [
    coupon?.applied,
    coupon?.code,
    coupon?.placement,
    onChange,
    persist,
    placement,
    subtotal,
    variantId,
    quantity,
    contextKey
  ]);

  async function applyCoupon(rawCode) {
    const normalizedCode = String(rawCode || "").trim().toUpperCase();

    if (!normalizedCode) {
      setError("Enter a coupon code.");
      return;
    }

    setEnteredCode(normalizedCode);
    setApplying(true);
    setError("");

    try {
      const quote = await validateCustomerCoupon({
        code: normalizedCode,
        placement,
        variantId,
        quantity
      });
      const nextCoupon = {
        ...quote,
        placement,
        applied: true
      };
      if (persist) saveAppliedCoupon(nextCoupon);
      onChange(nextCoupon);
    } catch (applyError) {
      setError(applyError?.message || "Unable to apply this coupon.");
    } finally {
      setApplying(false);
    }
  }

  function handleApply(event) {
    event.preventDefault();
    return applyCoupon(code);
  }

  function handleRemove() {
    if (persist) clearAppliedCoupon();
    onChange(null);
    setError("");
  }

  return (
    <section className="coupon-application" aria-label="Apply a coupon">
      <div className="coupon-application__heading">
        <TicketPercent size={18} aria-hidden="true" />
        <div>
          <strong>Apply a coupon</strong>
          <span>Only coupons eligible for your order are shown.</span>
        </div>
      </div>

      <form className="coupon-application__form" onSubmit={handleApply}>
        <label className="coupon-application__input-wrap">
          <span className="sr-only">Coupon code</span>
          <input
            value={code}
            onChange={(event) => setEnteredCode(event.target.value)}
            placeholder="Enter coupon code"
            autoComplete="off"
            disabled={applying}
            aria-invalid={Boolean(error)}
          />
        </label>
        <button
          type="submit"
          className="coupon-application__apply"
          disabled={applying}
        >
          {applying ? "Checking..." : coupon?.applied ? "Replace" : "Apply"}
        </button>
        {coupon?.applied && (
          <button
            type="button"
            className="coupon-application__remove"
            disabled={applying}
            onClick={handleRemove}
            aria-label={`Remove coupon ${coupon.code}`}
          >
            <X size={15} />
            Remove
          </button>
        )}
      </form>

      {coupon?.applied && (
        <div className="coupon-application__success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>
            {coupon.code} applied - saving ₹{formatPrice(coupon.discount_amount)}
          </span>
        </div>
      )}

      {error && <p className="coupon-application__error" role="alert">{error}</p>}

      {coupons.length > 0 && (
        <div className="coupon-application__available">
          <span className="coupon-application__available-title">
            Available here
          </span>
          {coupons.map((availableCoupon) => (
            <div
              key={availableCoupon.id || availableCoupon.code}
              className="coupon-application__coupon"
            >
              <div className="coupon-application__coupon-details">
                <strong>{availableCoupon.code}</strong>
                <span>
                  {availableCoupon.description ||
                    (availableCoupon.discount_type === "percentage"
                      ? `${availableCoupon.discount_value}% off`
                      : `₹${formatPrice(availableCoupon.discount_value)} off`)}
                </span>
                {Number(availableCoupon.min_order_value) > 0 && (
                  <small>
                    Min. order ₹{formatPrice(availableCoupon.min_order_value)}
                  </small>
                )}
                {availableCoupon.discount_type === "percentage" &&
                  Number(availableCoupon.max_discount_amount) > 0 && (
                    <small>
                      Maximum savings ₹
                      {formatPrice(availableCoupon.max_discount_amount)}
                    </small>
                  )}
              </div>
              <button
                type="button"
                disabled={
                  applying ||
                  (coupon?.applied &&
                    coupon.code === availableCoupon.code)
                }
                onClick={() => applyCoupon(availableCoupon.code)}
                aria-label={`Apply coupon ${availableCoupon.code}`}
              >
                {coupon?.applied &&
                coupon.code === availableCoupon.code
                  ? "Applied"
                  : "Apply"}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loadingCoupons && coupons.length === 0 && !error && (
        <p className="coupon-application__empty">
          No coupons are available for this page.
        </p>
      )}
    </section>
  );
}
