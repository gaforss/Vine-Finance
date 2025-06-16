const NodeCache = require('node-cache');

// stdTTL: time-to-live in seconds for every key. 600 seconds = 10 minutes
const cache = new NodeCache({ stdTTL: 600 });

module.exports = cache; 