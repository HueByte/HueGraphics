import React from 'react';
import './PageNav.css';

function PageNav({ items, title }) {
  if (!items || items.length === 0) return null;

  return (
    <nav className="page-nav">
      {title && <h4 className="page-nav-title">{title}</h4>}
      <div className="page-nav-list">
        {items}
      </div>
    </nav>
  );
}

export default PageNav;
