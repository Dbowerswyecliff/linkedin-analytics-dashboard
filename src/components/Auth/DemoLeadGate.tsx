import { useState } from 'react';
import { submitDemoLead } from '@/services/demo-leads';
import './auth.css';

const DEMO_ACCESS_KEY = 'demo_access_granted';
const DEMO_VISITOR_KEY = 'demo_visitor';

export interface DemoVisitor {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
}

export function hasDemoAccess(): boolean {
  return sessionStorage.getItem(DEMO_ACCESS_KEY) === 'true';
}

export function getDemoVisitor(): DemoVisitor | null {
  try {
    const stored = sessionStorage.getItem(DEMO_VISITOR_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function grantDemoAccess(visitor: DemoVisitor): void {
  sessionStorage.setItem(DEMO_ACCESS_KEY, 'true');
  sessionStorage.setItem(DEMO_VISITOR_KEY, JSON.stringify(visitor));
}

export function clearDemoAccess(): void {
  sessionStorage.removeItem(DEMO_ACCESS_KEY);
  sessionStorage.removeItem(DEMO_VISITOR_KEY);
}

export default function DemoLeadGate() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = firstName.trim() && lastName.trim() && company.trim() && email.trim() && email.includes('@');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsSubmitting(true);
    setError(null);

    const visitor: DemoVisitor = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company.trim(),
      email: email.trim().toLowerCase(),
    };

    try {
      await submitDemoLead(visitor);
      grantDemoAccess(visitor);
      window.location.reload();
    } catch (err) {
      console.error('[DemoGate] Lead submission failed:', err);
      grantDemoAccess(visitor);
      window.location.reload();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: '460px' }}>
        <div className="login-logo">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#0A66C2">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
          </svg>
          <span className="login-title">LinkedIn Analytics Dashboard</span>
        </div>

        <h1>Explore the Demo</h1>
        <p className="login-subtitle">
          See how our LinkedIn analytics dashboard tracks employee engagement, impressions, and content performance across your team.
        </p>

        {error && (
          <div className="login-error">
            <span>{error}</span>
          </div>
        )}

        <form className="demo-lead-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="demo-first-name">First Name</label>
              <input
                id="demo-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                required
                autoComplete="given-name"
              />
            </div>
            <div className="form-field">
              <label htmlFor="demo-last-name">Last Name</label>
              <input
                id="demo-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                required
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="demo-company">Company</label>
            <input
              id="demo-company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Corp"
              required
              autoComplete="organization"
            />
          </div>

          <div className="form-field">
            <label htmlFor="demo-email">Work Email</label>
            <input
              id="demo-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@acme.com"
              required
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            className="monday-login-btn"
            disabled={isSubmitting || !isValid}
          >
            {isSubmitting ? (
              <>
                <div className="btn-spinner" />
                <span>Launching demo...</span>
              </>
            ) : (
              <span>Launch Interactive Demo</span>
            )}
          </button>
        </form>

        <p className="login-note">
          Your info is only used to personalize the demo experience. We won't spam you.
        </p>
      </div>
    </div>
  );
}
