
import { useLayoutEffect } from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";

import {
  motion,
  AnimatePresence,
} from "framer-motion";

import MainLayout from "../layouts/MainLayout";

import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";

import Products from "../pages/Products";
import ProductDetails from "../pages/ProductDetails";

import Wishlist from "../pages/Wishlist";
import Cart from "../pages/Cart";
import Checkout from "../pages/Checkout";

import Profile from "../pages/Profile";
import Orders from "../pages/Orders";
import OrderDetails from "../pages/OrderDetails";

import About from "../pages/About";
import Contact from "../pages/Contact";
import Coupons from "../pages/Coupons";
import Deals from "../pages/Deals";
import RecentlyViewed from "../pages/RecentlyViewed";
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";
import AccountSection from "../pages/AccountSection";

/* ============================================================
   AUMVEDA CUSTOMER WEB — APP ROUTER

   UPDATED:
   - Prevent full-page remount on query changes
   - Keep Products sidebar mounted
   - Only product results update when filters change
   - Preserve scroll position on category selection
   - Scroll to top only on actual page navigation
   - Preserve Framer Motion transitions
   - Preserve all existing routes

   IMPORTANT:
   Route animation key uses pathname ONLY.
   location.search is intentionally excluded.
============================================================ */

/* ============================================================
   SCROLL MANAGEMENT

   Scroll to top only when the page path changes.

   Examples:

   /products
   → /products?category=hair
   No scroll reset.

   /products?category=hair
   → /products?category=skin
   No scroll reset.

   /products
   → /products/product-slug
   Scroll to top.
============================================================ */

function ScrollManager() {
  const location = useLocation();

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    document.documentElement.style.scrollBehavior =
      "auto";

    document.body.style.scrollBehavior = "auto";

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, [location.pathname]);

  return null;
}

/* ============================================================
   ANIMATED ROUTES

   Critical fix:

   OLD:
   key={`${location.pathname}${location.search}`}

   NEW:
   key={location.pathname}

   Category and filter query changes no longer
   cause the entire page to unmount.
============================================================ */

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence
      mode="wait"
      initial={false}
    >
      <motion.div
        key={location.pathname}
        initial={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        exit={{
          opacity: 0,
        }}
        transition={{
          duration: 0.28,
          ease: "easeOut",
        }}
      >
        <Routes location={location}>

          {/* HOME */}

          <Route
            path="/"
            element={<HomePage />}
          />

          {/* AUTHENTICATION */}

          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route
            path="/signup"
            element={<SignupPage />}
          />

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />

          <Route
            path="/reset-password"
            element={<ResetPassword />}
          />

          {/* PRODUCTS */}

          <Route
            path="/products"
            element={<Products />}
          />

          <Route
            path="/products/:slug"
            element={<ProductDetails />}
          />

          <Route
            path="/deals"
            element={<Deals />}
          />

          <Route
            path="/coupons"
            element={<Coupons />}
          />

          <Route
            path="/recently-viewed"
            element={<RecentlyViewed />}
          />

          {/* WISHLIST */}

          <Route
            path="/wishlist"
            element={<Wishlist />}
          />

          {/* CART */}

          <Route
            path="/cart"
            element={<Cart />}
          />

          {/* CHECKOUT */}

          <Route
            path="/checkout"
            element={<Checkout />}
          />

          {/* PROFILE */}

          <Route
            path="/profile"
            element={<Profile />}
          />

          <Route
            path="/account/:section"
            element={<AccountSection />}
          />

          {/* MY ORDERS */}

          <Route
            path="/orders/:orderId"
            element={<OrderDetails />}
          />

          <Route
            path="/orders"
            element={<Orders />}
          />

          {/* ABOUT */}

          <Route
            path="/about"
            element={<About />}
          />

          {/* CONTACT */}

          <Route
            path="/contact"
            element={<Contact />}
          />

          {/* FALLBACK */}

          <Route
            path="*"
            element={<HomePage />}
          />

        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

/* ============================================================
   MAIN APP ROUTER
============================================================ */

function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollManager />

      <MainLayout>
        <AnimatedRoutes />
      </MainLayout>
    </BrowserRouter>
  );
}

export default AppRouter;
