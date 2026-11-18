import { useEffect, useState } from "react";
import { CheckCircle2, TicketPercent, X } from "lucide-react";

import { getHomeCoupons } from "../../services/homeService";
import { validateCustomerCoupon } from "../../services/orderService";
import {
  clearAppliedCoupon,
  saveAppliedCoupon
} from "../../services/appliedCouponStorage";

import "../../styles/coupon-application.css";

function getCouponList(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export default function CouponApplication({
  placement,
  subtotal,
  coupon,
  onChange
}) {
  const [coupons, setCoupons] = useState([]);
  const [enteredCode, setEnteredCode] = useState(null);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const code = enteredCode ?? coupon?.code ?? "";

  useEffect(() => {
    let active = true;

    getHomeCoupons(placement)
      .then((response) => {
        if (active) setCoupons(getCouponList(response));
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
  }, [placement]);

  useEffect(() => {
    if (!coupon?.applied || !coupon.code) return undefined;

    let active = true;
    const appliedPlacement = coupon.placement || placement;

    validateCustomerCoupon({
      code: coupon.code,
      placement: appliedPlacement
    })
      .then((quote) => {
        if (!active) return;
        const updatedCoupon = {
          ...quote,
          placement: appliedPlacement,
          applied: true
        };
        saveAppliedCoupon(updatedCoupon);
        onChange(updatedCoupon);
        setError("");
      })
      .catch((validationError) => {
        if (!active) return;
        clearAppliedCoupon();
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
    placement,
    subtotal
  ]);

  async function handleApply(event) {
    event.preventDefault();
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      setError("Enter a coupon code.");
      return;
    }

    setApplying(true);
    setError("");

    try {
      const quote = await validateCustomerCoupon({
        code: normalizedCode,
        placement
      });
      const nextCoupon = {
        ...quote,
        placement,
        applied: true
      };
      saveAppliedCoupon(nextCoupon);
      onChange(nextCoupon);
    } catch (applyError) {
      setError(applyError?.message || "Unable to apply this coupon.");
    } finally {
      setApplying(false);
    }
  }

  function handleRemove() {
    clearAppliedCoupon();
    onChange(null);
    setError("");
  }

  return (
    <section className="coupon-application" aria-label="Apply a coupon">
      <div className="coupon-application__heading">
        <TicketPercent size={18} aria-hidden="true" />
        <div>
          <strong>Apply a coupon</strong>
          <span>Only coupons enabled for this page are shown.</span>
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
            aria-invalid={Boolean(error)}
          />
        </label>
        {coupon?.applied ? (
          <button
            type="button"
            className="coupon-application__remove"
            onClick={handleRemove}
            aria-label={`Remove coupon ${coupon.code}`}
          >
            <X size={15} />
            Remove
          </button>
        ) : (
          <button
            type="submit"
            className="coupon-application__apply"
            disabled={applying}
          >
            {applying ? "Checking..." : "Apply"}
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
            <button
              type="button"
              key={availableCoupon.id || availableCoupon.code}
              className="coupon-application__coupon"
              onClick={() => setEnteredCode(availableCoupon.code || "")}
              aria-label={`Use coupon ${availableCoupon.code}`}
            >
              <strong>{availableCoupon.code}</strong>
              <span>
                {availableCoupon.description ||
                  (availableCoupon.discount_type === "percentage"
                    ? `${availableCoupon.discount_value}% off`
                    : `₹${formatPrice(availableCoupon.discount_value)} off`)}
              </span>
            </button>
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
