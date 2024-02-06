import React from 'react';
import { useNavigate } from 'react-router-dom';

function SettingsPage() {
  const navigate = useNavigate();

  const navigateToPopup = () => {
    navigate('/popup');
  };

  return (
    <div>
      <h1>設定ページ📄</h1>
      <button onClick={navigateToPopup}>ポップアップページへ🚀</button>
    </div>
  );
}

export default SettingsPage;
