import { ArrowLeft, Bell, Globe2, Settings } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import "../styles/discovery-pages.css";

const ACCOUNT_SECTIONS = {
  settings: {
    title: "Settings",
    description: "Manage your Aumveda account preferences.",
    options: [
      { label: "Notifications", route: "/account/notifications" },
      { label: "Language", route: "/account/language" },
    ],
  },
  notifications: {
    title: "Notifications",
    description:
      "Push notification preferences are not available yet. Important order updates will still be shown in your account.",
    options: [],
  },
  language: {
    title: "Language",
    description: "English is currently the only language available.",
    options: [],
  },
};

export default function AccountSection() {
  const { section } = useParams();
  const content = ACCOUNT_SECTIONS[section];

  return (
    <main className="discovery-page">
      <div className="discovery-page__container">
        <Link className="discovery-page__back" to="/profile">
          <ArrowLeft size={16} />
          Back to Profile
        </Link>

        <header className="discovery-page__header">
          <span className="discovery-page__eyebrow">
            {section === "notifications" ? (
              <Bell size={15} />
            ) : section === "language" ? (
              <Globe2 size={15} />
            ) : (
              <Settings size={15} />
            )}
            ACCOUNT PREFERENCES
          </span>
          <h1>{content?.title || "Account"}</h1>
          <p>{content?.description || "This account section is unavailable."}</p>
        </header>

        {content?.options.length > 0 && (
          <nav className="account-section__options" aria-label="Account settings">
            {content.options.map(option => (
              <Link
                className="account-section__option"
                key={option.route}
                to={option.route}
              >
                {option.label}
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </nav>
        )}
      </div>
    </main>
  );
}
