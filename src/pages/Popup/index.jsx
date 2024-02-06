import React from 'react';
import { render } from 'react-dom';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Popup from './Popup';
import SettingsPage from './SettingPage';
import './index.css';

render(
  <Router>
    <Routes>
      <Route path="/*" element={<Popup />} />
      <Route path="/" element={<SettingsPage />} />
    </Routes>
  </Router>,
  window.document.querySelector('#app-container')
);

if (module.hot) module.hot.accept();
