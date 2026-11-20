
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/useAuth";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const result = register(name, email);

    if (result.success) {
      navigate("/login", {
        replace: true,
        state: { registered: true },
      });
    } else {
      setError(result.message);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-icon"><ShieldCheck size={25} /></div>
          <div>
            <h2>LedgerGuard</h2>
            <span>FINANCIAL PLATFORM</span>
          </div>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">GET STARTED</p>
          <h1>Create your account</h1>
          <p>Set up your financial workspace.</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="register-name">Full name</label>
          <input
            id="register-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
          />

          <label htmlFor="register-email">Work email</label>
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />

          <label htmlFor="register-password">Password</label>
          <div className="password-field">
            <input
              id="register-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <label htmlFor="confirm-password">Confirm password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            required
          />

          <button className="auth-submit" type="submit">
            Create account <ArrowRight size={17} />
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>

        <p className="auth-footer">SECURE FINANCIAL WORKSPACE</p>
      </section>
    </main>
  );
}
