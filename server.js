require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connesso'))
  .catch(err => console.error('MongoDB errore:', err));

const otcRoutes = require('./controllers/otcController'); // ← corretto
app.use('/api/otc', otcRoutes); // ← corretto

app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`LIVE su https://neonoble-otc-desk.onrender.com`));
