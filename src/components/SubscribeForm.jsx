import { useState } from 'react';

const SubscribeForm = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setStatus('error');
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Failed to subscribe.');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage('Network error. Please try again.');
    }
  };

  return (
    <div className="subscribe-container">
      {status === 'success' ? (
        <p className="subscribe-success">Thanks — check your inbox.</p>
      ) : (
        <>
          <span className="subscribe-label">Subscribe for new posts</span>
          <form className="subscribe-form" onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === 'error') setStatus('idle');
              }}
              placeholder="email@example.com"
              className={`subscribe-input ${status === 'error' ? 'error' : ''}`}
              disabled={status === 'loading'}
              aria-label="Email address"
            />
            <button
              type="submit"
              className="subscribe-button"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? '...' : 'Subscribe'}
            </button>
          </form>
          {status === 'error' && (
            <p className="subscribe-error-text">{errorMessage}</p>
          )}
        </>
      )}
    </div>
  );
};

export default SubscribeForm;
