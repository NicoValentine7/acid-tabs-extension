import React from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Fab from '@mui/material/Fab';
import EditIcon from '@mui/icons-material/Edit';

function SettingsPage() {
  const navigate = useNavigate();

  const navigateToPopup = () => {
    navigate('/popup');
  };

  return (
    <React.Fragment>
      <CssBaseline />
      <Typography
        component="div"
        style={{ backgroundColor: '#061D30', height: '200vh' }}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Box sx={{ position: 'absolute', right: 16, top: 16 }}>
          <Fab color="secondary" aria-label="edit" onClick={navigateToPopup}>
            <EditIcon />
          </Fab>
        </Box>
      </Typography>
    </React.Fragment>
  );
}

export default SettingsPage;
