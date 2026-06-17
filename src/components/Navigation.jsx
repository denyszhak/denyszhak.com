import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { FiGithub, FiLinkedin, FiMail, FiSun, FiMoon } from 'react-icons/fi';
import { FaXTwitter } from 'react-icons/fa6';

const Navigation = () => {
  const [isLightMode, setIsLightMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme !== 'dark';
  });

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [isLightMode]);

  const toggleTheme = () => {
    const newMode = !isLightMode;
    setIsLightMode(newMode);
    localStorage.setItem('theme', newMode ? 'light' : 'dark');
  };

  return (
    <header className="site-header">
      <nav className="nav-links">
        <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          [about]
        </NavLink>
        <NavLink to="/writing" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          [writing]
        </NavLink>
        <NavLink to="/open-source" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          [open source]
        </NavLink>

      </nav>
      <div className="social-links">
        <a href="https://www.linkedin.com/in/denyszhak/" target="_blank" rel="noopener noreferrer" className="social-link">
          <FiLinkedin size={20} />
        </a>
        <a href="https://github.com/denyszhak" target="_blank" rel="noopener noreferrer" className="social-link">
          <FiGithub size={20} />
        </a>
        <a href="https://x.com/denyszhak_" target="_blank" rel="noopener noreferrer" className="social-link">
          <FaXTwitter size={20} />
        </a>
        <a href="mailto:denyszhak@gmail.com" className="social-link">
          <FiMail size={20} />
        </a>
        <button 
          onClick={toggleTheme} 
          className="social-link" 
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: '1rem' }}
          aria-label="Toggle theme"
        >
          {isLightMode ? <FiMoon size={20} /> : <FiSun size={20} />}
        </button>
      </div>
    </header>
  );
};

export default Navigation;
