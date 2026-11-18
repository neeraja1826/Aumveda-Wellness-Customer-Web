
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Bell,
  ChevronDown,
  Heart,
  LogOut,
  Menu,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";

import { getBrandingSettings } from "../../services/siteSettingsService";
import {
  getCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
} from "../../services/notificationService";

import "../../styles/navbar.css";

function playNotificationSound(audioContext) {
  if (!audioContext || audioContext.state !== "running") return false;

  const startTime = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(784, startTime);
  oscillator.frequency.setValueAtTime(988, startTime + 0.12);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.08, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.3);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(startTime);
  oscillator.stop(startTime + 0.31);
  return true;
}

/* ============================================================
   AUMVEDA — CUSTOMER WEB NAVBAR

   - Full-width white/ivory navbar
   - CMS-controlled logo
   - Centered product search
   - Home and Products navigation
   - Wishlist and cart counts
   - Authentication-aware profile
   - Account dropdown and logout
   - Responsive mobile navigation

   Existing routes and backend integrations preserved.
============================================================ */

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  /* ==========================================================
     AUTHENTICATION
  ========================================================== */

  const {
    user,
    isAuthenticated,
    loading: authLoading,
    displayName,
    logout,
  } = useAuth();

  /* ==========================================================
     CART
  ========================================================== */

  const cartContext = useCart();

  const totalQuantity = Number(
    cartContext?.totalQuantity ??
      cartContext?.items?.reduce(
        (total, item) =>
          total + Number(item?.quantity || 0),
        0
      ) ??
      0
  );

  /* ==========================================================
     WISHLIST
  ========================================================== */

  const { wishlistCount = 0 } = useWishlist();

  const safeWishlistCount = Number(
    wishlistCount || 0
  );

  /* ==========================================================
     COMPONENT STATE
  ========================================================== */

  const [searchText, setSearchText] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);
  const [profileMenuOpen, setProfileMenuOpen] =
    useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] =
    useState(false);
  const [notificationData, setNotificationData] = useState({
    userId: null,
    items: [],
    unreadCount: 0,
  });
  const [notificationsLoading, setNotificationsLoading] =
    useState(false);
  const [notificationError, setNotificationError] =
    useState("");

  const [logoFailed, setLogoFailed] =
    useState(false);

  const [branding, setBranding] = useState({
    site_name: "AUMVEDA",
    logo_url: "",
    favicon_url: "",
    branding_version: 1,
  });

  const profileWrapperRef = useRef(null);
  const notificationWrapperRef = useRef(null);
  const notificationAudioContextRef = useRef(null);
  const notificationAudioReadyRef = useRef(false);
  const pendingNotificationSoundRef = useRef(false);
  const notificationBaselineRef = useRef({
    userId: null,
    ids: new Set(),
    initialized: false,
  });
  const notificationsBelongToCurrentUser =
    notificationData.userId === user?.id;
  const notifications = notificationsBelongToCurrentUser
    ? notificationData.items
    : [];
  const unreadNotificationCount = notificationsBelongToCurrentUser
    ? notificationData.unreadCount
    : 0;

  useEffect(() => {
    let active = true;

    function removeUnlockListeners() {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    }

    function unlockAudio() {
      if (notificationAudioReadyRef.current) return;

      const AudioContextConstructor =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextConstructor) {
        console.warn("Notification sound is not supported by this browser.");
        removeUnlockListeners();
        return;
      }

      try {
        const audioContext =
          notificationAudioContextRef.current ||
          new AudioContextConstructor();
        notificationAudioContextRef.current = audioContext;

        audioContext.resume().then(() => {
          if (!active || audioContext.state !== "running") return;

          notificationAudioReadyRef.current = true;
          removeUnlockListeners();

          if (pendingNotificationSoundRef.current) {
            pendingNotificationSoundRef.current =
              !playNotificationSound(audioContext);
          }
        }).catch((error) => {
          console.warn("Unable to enable notification sound:", error);
        });
      } catch (error) {
        console.warn("Unable to enable notification sound:", error);
      }
    }

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    return () => {
      active = false;
      removeUnlockListeners();
      if (notificationAudioContextRef.current) {
        notificationAudioContextRef.current.close().catch((error) => {
          console.warn("Unable to close notification audio:", error);
        });
        notificationAudioContextRef.current = null;
      }
    };
  }, []);

  const refreshNotifications = useCallback(async (
    showLoading = false,
    signal,
  ) => {
    if (!isAuthenticated || !user?.id) {
      notificationBaselineRef.current = {
        userId: null,
        ids: new Set(),
        initialized: false,
      };
      return;
    }

    if (showLoading) {
      setNotificationsLoading(true);
    }

    try {
      const result = await getCustomerNotifications({
        limit: 10,
        signal,
      });
      const currentIds = new Set(
        result.items
          .map((notification) => notification.id)
          .filter((id) => id !== null && id !== undefined)
          .map(String),
      );
      const baseline = notificationBaselineRef.current;

      if (
        baseline.initialized &&
        baseline.userId === user.id &&
        Array.from(currentIds).some((id) => !baseline.ids.has(id))
      ) {
        pendingNotificationSoundRef.current =
          !playNotificationSound(notificationAudioContextRef.current);
      }

      notificationBaselineRef.current = {
        userId: user.id,
        ids: currentIds,
        initialized: true,
      };
      setNotificationData({
        userId: user.id,
        items: result.items,
        unreadCount: result.unreadCount,
      });
      setNotificationError("");
    } catch (error) {
      if (error?.name === "AbortError") return;

      console.error("Customer notifications failed to load:", error);
      setNotificationError(
        error?.message || "Unable to load notifications.",
      );
    } finally {
      if (showLoading) {
        setNotificationsLoading(false);
      }
    }
  }, [isAuthenticated, user]);

  /* ==========================================================
     FETCH BRANDING FROM EXISTING CMS
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    async function loadBranding() {
      try {
        const data = await getBrandingSettings();

        if (mounted && data) {
          setBranding((previous) => ({
            ...previous,
            ...data,
          }));
        }
      } catch (error) {
        console.error(
          "Navbar branding load failed:",
          error
        );
      }
    }

    loadBranding();

    return () => {
      mounted = false;
    };
  }, []);

  const siteName =
    branding?.site_name || "AUMVEDA";

  const logoUrl = branding?.logo_url
    ? (() => {
        const separator =
          branding.logo_url.includes("?")
            ? "&"
            : "?";

        return (
          branding.logo_url +
          separator +
          `v=${branding.branding_version || 1}`
        );
      })()
    : "";

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  /* ==========================================================
     ACTIVE ROUTES
  ========================================================== */

  const activePath = location.pathname;

  const isHomeActive = activePath === "/";

  const isProductsActive =
    activePath === "/products" ||
    activePath.startsWith("/products/");

  const isWishlistActive =
    activePath === "/wishlist";

  const isCartActive =
    activePath === "/cart";

  const isProfileActive =
    activePath === "/profile";

  function navClass(active) {
    return [
      "aumveda-nav-link",
      active
        ? "aumveda-nav-link--active"
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  /* ==========================================================
     CLOSE MENUS
  ========================================================== */

  function closeMenus() {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
    setNotificationMenuOpen(false);
  }

  /* ==========================================================
     SEARCH
  ========================================================== */

  function handleSearch(event) {
    event.preventDefault();

    const query = searchText.trim();

    if (!query) return;

    closeMenus();

    navigate(
      `/products?search=${encodeURIComponent(query)}`
    );
  }

  /* ==========================================================
     WISHLIST
  ========================================================== */

  function handleWishlistClick() {
    closeMenus();
    navigate("/wishlist");
  }

  /* ==========================================================
     CART
  ========================================================== */

  function handleCartClick() {
    if (authLoading) return;

    closeMenus();

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    navigate("/cart");
  }

  /* ==========================================================
     PROFILE
  ========================================================== */

  function handleProfileClick() {
    if (authLoading) return;

    closeMenus();

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    navigate("/profile");
  }

  function handleNotificationToggle() {
    if (authLoading) return;

    if (!isAuthenticated) {
      closeMenus();
      navigate("/login");
      return;
    }

    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
    if (notificationMenuOpen) {
      setNotificationMenuOpen(false);
    } else {
      setNotificationMenuOpen(true);
      refreshNotifications();
    }
  }

  async function handleMarkAllNotificationsRead() {
    try {
      await markAllCustomerNotificationsRead();
      setNotificationData((previous) =>
        previous.userId === user?.id
          ? {
              ...previous,
              items: previous.items.map((notification) => ({
                ...notification,
                is_read: true,
              })),
              unreadCount: 0,
            }
          : previous,
      );
      setNotificationError("");
    } catch (error) {
      console.error("Unable to mark notifications as read:", error);
      setNotificationError(
        error?.message || "Unable to mark notifications as read.",
      );
    }
  }

  async function handleNotificationClick(notification) {
    if (!notification.is_read) {
      try {
        await markCustomerNotificationRead(notification.id);
        setNotificationData((previous) =>
          previous.userId === user?.id
            ? {
                ...previous,
                items: previous.items.map((item) =>
                  item.id === notification.id
                    ? { ...item, is_read: true }
                    : item,
                ),
                unreadCount: Math.max(0, previous.unreadCount - 1),
              }
            : previous,
        );
        setNotificationError("");
      } catch (error) {
        console.error("Unable to mark notification as read:", error);
        setNotificationError(
          error?.message || "Unable to update this notification.",
        );
        return;
      }
    }

    setNotificationMenuOpen(false);
    navigate(
      `/notifications?notification=${encodeURIComponent(notification.id)}`,
    );
  }

  function formatNotificationTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  /* ==========================================================
     ACCOUNT MENU
  ========================================================== */

  function handleAccountMenuToggle() {
    if (authLoading) return;

    if (!isAuthenticated) {
      setProfileMenuOpen(false);
      navigate("/login");
      return;
    }

    setMobileMenuOpen(false);
    setNotificationMenuOpen(false);

    setProfileMenuOpen(
      (previous) => !previous
    );
  }

  /* ==========================================================
     LOGOUT
  ========================================================== */

  async function handleLogout() {
    try {
      await logout();

      closeMenus();

      navigate("/", {
        replace: true,
      });
    } catch (error) {
      console.error(
        "AUMVEDA logout failed:",
        error
      );
    }
  }

  /* ==========================================================
     CLOSE MENUS ON ROUTE CHANGE
  ========================================================== */

  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const controller = new AbortController();
    const refresh = () =>
      refreshNotifications(false, controller.signal);
    const refreshOnFocus = () => refresh();

    refreshNotifications(true, controller.signal);
    const intervalId = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [isAuthenticated, refreshNotifications, user?.id]);

  /* ==========================================================
     OUTSIDE CLICK / ESCAPE
  ========================================================== */

  useEffect(() => {
    function onOutsideClick(event) {
      if (
        profileWrapperRef.current &&
        !profileWrapperRef.current.contains(
          event.target
        )
      ) {
        setProfileMenuOpen(false);
      }

      if (
        notificationWrapperRef.current &&
        !notificationWrapperRef.current.contains(event.target)
      ) {
        setNotificationMenuOpen(false);
      }
    }

    function onEscape(event) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setMobileMenuOpen(false);
        setNotificationMenuOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      onOutsideClick
    );

    document.addEventListener(
      "keydown",
      onEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        onOutsideClick
      );

      document.removeEventListener(
        "keydown",
        onEscape
      );
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setProfileMenuOpen(false);
    }
  }, [isAuthenticated]);

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <header className="aumveda-navbar">
      <div className="aumveda-navbar__inner">

        {/* ================================================
            LEFT — BRAND
        ================================================ */}

        <Link
          to="/"
          className="aumveda-brand"
          aria-label={`${siteName} Home`}
          onClick={closeMenus}
        >
          <div className="aumveda-brand-wrapper">
            {logoUrl && !logoFailed ? (
              <img
                src={logoUrl}
                alt={siteName}
                className="aumveda-brand__logo"
                onError={() =>
                  setLogoFailed(true)
                }
              />
            ) : (
              <span className="aumveda-brand__fallback">
                {siteName}
              </span>
            )}
          </div>
        </Link>

        {/* ================================================
            CENTER — SEARCH
        ================================================ */}

        <form
          className="aumveda-search"
          onSubmit={handleSearch}
          role="search"
        >
          <Search
            size={18}
            strokeWidth={1.8}
            className="aumveda-search__icon"
            aria-hidden="true"
          />

          <input
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder="Search products & wellness essentials..."
            aria-label="Search products on AUMVEDA"
          />

          <button
            type="submit"
            className="aumveda-search__button"
          >
            Search
          </button>
        </form>

        {/* ================================================
            RIGHT — NAVIGATION & ACTIONS
        ================================================ */}

        <div className="aumveda-navbar__right">

          <nav
            className="aumveda-nav-links"
            aria-label="Main navigation"
          >
            <Link
              to="/"
              className={navClass(isHomeActive)}
              aria-current={
                isHomeActive ? "page" : undefined
              }
            >
              Home
            </Link>

            <Link
              to="/products"
              className={navClass(isProductsActive)}
              aria-current={
                isProductsActive ? "page" : undefined
              }
            >
              Products
            </Link>
          </nav>

          <div className="aumveda-navbar__actions">

            {/* WISHLIST */}

            <button
              type="button"
              className={
                `aumveda-action ` +
                (isWishlistActive
                  ? "aumveda-action--active"
                  : "")
              }
              onClick={handleWishlistClick}
              aria-label={
                `Wishlist, ${safeWishlistCount} items`
              }
              title="Wishlist"
            >
              <span className="aumveda-action__icon-shell">
                <Heart
                  size={20}
                  strokeWidth={1.8}
                  fill={
                    isWishlistActive
                      ? "currentColor"
                      : "none"
                  }
                />

                {safeWishlistCount > 0 && (
                  <span className="aumveda-action__badge">
                    {safeWishlistCount > 99
                      ? "99+"
                      : safeWishlistCount}
                  </span>
                )}
              </span>

              <span className="aumveda-action__label">
                Wishlist
              </span>
            </button>

            {/* CART */}

            <button
              type="button"
              className={
                `aumveda-action ` +
                (isCartActive
                  ? "aumveda-action--active"
                  : "")
              }
              onClick={handleCartClick}
              disabled={authLoading}
              aria-label={`Cart, ${totalQuantity} items`}
              title="Cart"
            >
              <span className="aumveda-action__icon-shell">
                <ShoppingCart
                  size={20}
                  strokeWidth={1.8}
                />

                {totalQuantity > 0 && (
                  <span className="aumveda-action__badge">
                    {totalQuantity > 99
                      ? "99+"
                      : totalQuantity}
                  </span>
                )}
              </span>

              <span className="aumveda-action__label">
                Cart
              </span>
            </button>

            {/* NOTIFICATIONS */}

            <div
              className="aumveda-notification-wrapper"
              ref={notificationWrapperRef}
            >
              <button
                type="button"
                className={
                  `aumveda-action ` +
                  (notificationMenuOpen
                    ? "aumveda-action--active"
                    : "")
                }
                onClick={handleNotificationToggle}
                disabled={authLoading}
                aria-label={
                  `Notifications, ${unreadNotificationCount} unread`
                }
                aria-haspopup="dialog"
                aria-expanded={notificationMenuOpen}
                aria-controls={
                  notificationMenuOpen
                    ? "aumveda-notification-menu"
                    : undefined
                }
                title="Notifications"
              >
                <span className="aumveda-action__icon-shell">
                  <Bell size={20} strokeWidth={1.8} />
                  {unreadNotificationCount > 0 && (
                    <span className="aumveda-action__badge">
                      {unreadNotificationCount > 99
                        ? "99+"
                        : unreadNotificationCount}
                    </span>
                  )}
                </span>
                <span className="aumveda-action__label">
                  Notifications
                </span>
              </button>

              {isAuthenticated && notificationMenuOpen && (
                <div
                  id="aumveda-notification-menu"
                  className="aumveda-notification-menu"
                  role="dialog"
                  aria-labelledby="aumveda-notification-title"
                >
                  <div className="aumveda-notification-menu__header">
                    <div>
                      <h2 id="aumveda-notification-title">
                        Notifications
                      </h2>
                      <p role="status" aria-live="polite">
                        {unreadNotificationCount
                          ? `${unreadNotificationCount} unread`
                          : "You're all caught up"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="aumveda-notification-menu__mark-all"
                      onClick={handleMarkAllNotificationsRead}
                      disabled={
                        unreadNotificationCount === 0 ||
                        notificationsLoading
                      }
                    >
                      Mark all read
                    </button>
                  </div>

                  {notificationError && (
                    <div
                      className="aumveda-notification-menu__error"
                      role="alert"
                    >
                      <span>{notificationError}</span>
                      <button
                        type="button"
                        onClick={() => refreshNotifications(true)}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {notificationsLoading ? (
                    <p
                      className="aumveda-notification-menu__state"
                      role="status"
                    >
                      Loading notifications...
                    </p>
                  ) : notifications.length === 0 ? (
                    <p className="aumveda-notification-menu__state">
                      No notifications yet.
                    </p>
                  ) : (
                    <ul className="aumveda-notification-menu__list">
                      {notifications.map((notification) => (
                        <li key={notification.id}>
                          <button
                            type="button"
                            className={
                              "aumveda-notification-item" +
                              (notification.is_read
                                ? ""
                                : " aumveda-notification-item--unread")
                            }
                            onClick={() =>
                              handleNotificationClick(notification)
                            }
                            aria-label={
                              `${notification.title}. ${notification.message}` +
                              (notification.is_read ? "" : ". Unread")
                            }
                          >
                            <span className="aumveda-notification-item__content">
                              <strong>{notification.title}</strong>
                              <span>{notification.message}</span>
                              <time dateTime={notification.created_at}>
                                {formatNotificationTime(
                                  notification.created_at,
                                )}
                              </time>
                            </span>
                            {!notification.is_read && (
                              <span
                                className="aumveda-notification-item__dot"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* PROFILE */}

            <div
              className="aumveda-profile-wrapper"
              ref={profileWrapperRef}
            >
              <div className="aumveda-profile-actions">
                <button
                  type="button"
                  className={
                    `aumveda-action ` +
                    (isProfileActive
                      ? "aumveda-action--active"
                      : "")
                  }
                  onClick={handleProfileClick}
                  disabled={authLoading}
                  aria-label={
                    isAuthenticated
                      ? "Open my profile"
                      : "Log in to my account"
                  }
                  title={
                    isAuthenticated
                      ? "My Account"
                      : "Login"
                  }
                >
                  <span className="aumveda-action__icon-shell">
                    <UserRound
                      size={20}
                      strokeWidth={1.8}
                    />
                  </span>

                  <span className="aumveda-action__label">
                    {isAuthenticated
                      ? "Profile"
                      : "Login"}
                  </span>
                </button>

                {isAuthenticated && (
                  <button
                    type="button"
                    className="aumveda-profile-dropdown-toggle"
                    onClick={handleAccountMenuToggle}
                    aria-label="Toggle account menu"
                    aria-haspopup="menu"
                    aria-expanded={profileMenuOpen}
                    aria-controls="aumveda-account-menu"
                    disabled={authLoading}
                  >
                    <ChevronDown
                      size={14}
                      className={
                        profileMenuOpen
                          ? "aumveda-profile-chevron--open"
                          : ""
                      }
                    />
                  </button>
                )}
              </div>

              {/* ACCOUNT DROPDOWN */}

              {isAuthenticated &&
                profileMenuOpen && (
                  <div
                    id="aumveda-account-menu"
                    className="aumveda-profile-menu"
                    role="menu"
                    aria-label="Account menu"
                  >
                    <div className="aumveda-profile-menu__header">
                      <div className="aumveda-profile-menu__avatar">
                        <UserRound size={19} />
                      </div>

                      <div className="aumveda-profile-menu__user">
                        <span className="aumveda-profile-menu__eyebrow">
                          My Account
                        </span>

                        <Link
                          to="/profile"
                          onClick={closeMenus}
                          className="aumveda-profile-menu__name"
                          role="menuitem"
                        >
                          {displayName ||
                            user?.email?.split("@")[0] ||
                            "My Profile"}
                        </Link>

                        <span className="aumveda-profile-menu__email">
                          {user?.email}
                        </span>
                      </div>
                    </div>

                    

                    <div className="aumveda-profile-menu__divider" />

                    <button
                      type="button"
                      className="aumveda-profile-menu__logout"
                      onClick={handleLogout}
                      role="menuitem"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                )}
            </div>

            {/* MOBILE MENU */}

            <button
              type="button"
              className="aumveda-mobile-toggle"
              aria-label={
                mobileMenuOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
              aria-expanded={mobileMenuOpen}
              onClick={() =>
                setMobileMenuOpen(
                  (previous) => !previous
                )
              }
            >
              {mobileMenuOpen ? (
                <X size={21} />
              ) : (
                <Menu size={21} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ================================================
          MOBILE NAVIGATION PANEL
      ================================================ */}

      {mobileMenuOpen && (
        <nav
          className="aumveda-mobile-nav"
          aria-label="Mobile navigation"
        >
          <Link
            to="/"
            onClick={closeMenus}
          >
            Home
          </Link>

          <Link
            to="/products"
            onClick={closeMenus}
          >
            Products
          </Link>

          <button
            type="button"
            onClick={handleWishlistClick}
          >
            Wishlist
            {safeWishlistCount > 0 && (
              <span>{safeWishlistCount}</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleCartClick}
            disabled={authLoading}
          >
            Cart
            {totalQuantity > 0 && (
              <span>{totalQuantity}</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleProfileClick}
            disabled={authLoading}
          >
            {isAuthenticated
              ? "Profile"
              : "Login / Sign Up"}
          </button>

          {isAuthenticated && (
            <button
              type="button"
              className="aumveda-mobile-nav__logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
