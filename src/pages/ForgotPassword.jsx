import { useState } from "react";
import { ArrowLeft, Leaf, Mail } from "lucide-react";
import { Link } from "react-router-dom";

import { supabase } from "../services/supabase";
import "../styles/auth.css";
import "../styles/discovery-pages.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error: requestError } =
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });

      if (requestError) throw requestError;

      setSuccess(
        "If an account exists for that address, you will receive a password reset link."
      );
    } catch (requestError) {
      console.error("Password reset request failed:", requestError);
      setError(requestError?.message || "Unable to send the reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-container auth-container--recovery">
        <section className="auth-brand-panel">
          <div className="auth-brand-content">
            <div className="auth-brand-mark"><Leaf size={28} /></div>
            <p className="auth-eyebrow">ACCOUNT RECOVERY</p>
            <h1>Return to your wellness journey.</h1>
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-form-wrapper">
            <Link className="discovery-page__back" to="/login">
              <ArrowLeft size={16} />
              Back to Login
            </Link>
            <div className="auth-heading">
              <p>PASSWORD RESET</p>
              <h2>Forgot Password?</h2>
              <span>Enter your registered email and we'll send you a reset link.</span>
            </div>

            {error && <div className="auth-message auth-message--error" role="alert">{error}</div>}
            {success && <div className="auth-message auth-message--success" role="status">{success}</div>}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="reset-email">Email Address</label>
                <div className="auth-input">
                  <Mail size={18} />
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              </div>
              <button className="auth-submit" type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
