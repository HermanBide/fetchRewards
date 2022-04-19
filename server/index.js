const express = require('express');
const pointsRoutes = require('./routes/points.js');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.use('/points', pointsRoutes)

app.get('/', (req, res) => res.send('Success!'));

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

