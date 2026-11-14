import { Link } from "react-router-dom";
import { ArrowLeft, TicketPercent } from "lucide-react";

import AvailableCoupons from "../components/home/AvailableCoupons";
import "../styles/discovery-pages.css";

export default function Coupons() {
  return (
    <main className="discovery-page">
      <div className="discovery-page__container">
        <Link className="discovery-page__back" to="/">
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <header className="discovery-page__header">
          <span className="discovery-page__eyebrow">
            <TicketPercent size={15} />
            AUMVEDA OFFERS
          </span>
          <h1>Available Coupons</h1>
          <p>Explore current offers and copy a code to use at checkout.</p>
        </header>

        <AvailableCoupons showAllLink={false} />
      </div>
    </main>
  );
}
