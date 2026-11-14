import { useState } from "react";
import { CheckCircle2, Leaf, Lock } from "lucide-react";
import { Link } from "react-router-dom";

import { supabase } from "../services/supabase";
import "../styles/auth.css";
import "../styles/discovery-pages.css";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } =
        await supabase.auth.updateUser({ password });

      if (updateError) throw updateError;
      setSuccess(true);
    } catch (updateError) {
      console.error("Password update failed:", updateError);
      setError(updateError?.message || "Unable to update your password.");
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
            <h1>Rooted in nature. Guided by Ayurveda.</h1>
          </div>
        </section>
        <section className="auth-form-panel">
          <div className="auth-form-wrapper">
            <div className="auth-heading">
              <p>PASSWORD RESET</p>
              <h2>{success ? "Password updated" : "Choose a new password"}</h2>
              <span>
                {success
                  ? "Your password has been changed. You can now sign in."
                  : "Set a new password for your Aumveda account."}
              </span>
            </div>

            {error && <div className="auth-message auth-message--error" role="alert">{error}</div>}

            {success ? (
              <div className="auth-recovery-success">
                <CheckCircle2 size={32} />
                <Link to="/login">Back to Login</Link>
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="auth-field">
                  <label htmlFor="new-password">New Password</label>
                  <div className="auth-input">
                    <Lock size={18} />
                    <input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                </div>
                <div className="auth-field">
                  <label htmlFor="confirm-password">Confirm Password</label>
                  <div className="auth-input">
                    <Lock size={18} />
                    <input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                </div>
                <button className="auth-submit" type="submit" disabled={loading}>
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
