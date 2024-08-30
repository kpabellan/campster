const axios = require('axios');
const fs = require('fs');
const { cart } = require('./cart');
const config = require('./config');
const { sendWebhook, formatDate } = require('./helper');

const proxyList = fs.readFileSync('proxylist.txt', 'utf-8').split('\n').filter(Boolean);
const userAgents = fs.readFileSync('useragents.txt', 'utf-8').split('\n').map(agent => agent.trim().replace(/[^\x20-\x7E]/g, '')).filter(Boolean); // Split new line, remove invalid characters, and remove empty strings

const cartedItems = new Map();
const cartTimeout = 10 * 60 * 1000;

function getRandomProxy() {
  const randomIndex = Math.floor(Math.random() * proxyList.length);
  return proxyList[randomIndex];
}

function getRandomUserAgent() {
  const randomIndex = Math.floor(Math.random() * userAgents.length);
  return userAgents[randomIndex];
}

function clearExpiredCartedItems() {
  const now = Date.now();
  for (const [itemKey, timestamp] of cartedItems.entries()) {
    if (now - timestamp > cartTimeout) {
      cartedItems.delete(itemKey);
      console.log(`Cleared carted item: ${itemKey}`);
    }
  }
}

function monitor(campgroundId, campgroundName, startDate) {
  clearExpiredCartedItems();

  const proxy = getRandomProxy();
  const userAgent = getRandomUserAgent();

  const year = startDate.split('-')[0];
  const month = startDate.split('-')[1];

  const start_date = `${year}-${month}-01T00:00:00.000Z`;

  let axiosConfig  = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `https://www.recreation.gov/api/camps/availability/campground/${campgroundId}/month?start_date=${encodeURIComponent(start_date)}`,
    proxy: {
      host: proxy.split(':')[0],
      port: proxy.split(':')[1],
      protocol: 'http',
    },
    headers: {
      'User-Agent': userAgent
    }
  };

  axios.request(axiosConfig)
    .then((response) => {
      const campsites = response.data.campsites;

      for (const campsiteId in campsites) {
        const availabilities = campsites[campsiteId].availabilities;

        for (const date in availabilities) {
          const itemKey = `${campsiteId}-${date}`;
          const formattedDate = formatDate(date);

          if (availabilities[date] === "Available" && !cartedItems.has(itemKey)) {
            console.log(`${campgroundName} is available on ${formattedDate}`);

            if (date === startDate + 'T00:00:00Z') {
 
              if (config.discordWebhook) {
                sendWebhook(`${campgroundName} is available on ${formattedDate} - <https://www.recreation.gov/camping/campsites/${campsiteId}>`);
              }

              cart(campsiteId, date, campgroundName);
              cartedItems.set(itemKey, Date.now());
            }
          }
        }
      }
    })
    .catch((e) => {
      console.log('Error' + e);
    });
}

function mainMonitor() {
  for (let i = 0; i < config.campsites.length; i++) {
    monitor(config.campsites[i].campgroundId, config.campsites[i].campgroundName, config.campsites[i].startDate);
  }
}

setInterval(mainMonitor, 5000);