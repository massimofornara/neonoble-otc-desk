require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connesso'))
  .catch(err => console.error('MongoDB errore:', err));

// Rotte API
const otcRoutes = require('./backend/controllers/otcController');
app.use('/api/otc', otcRoutes);

// Frontend nella root
app.use(express.static(__dirname));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`NeoNoble OTC Desk LIVE su https://neonoble-otc-desk.onrender.com`);
});
