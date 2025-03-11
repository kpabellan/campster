const axios = require('axios');
const fs = require('fs');
const { cart } = require('./cart');
const config = require('./config');
const { sendWebhook, formatDate } = require('./helper');

let proxyList = [];
if (config.proxies == 1) {
  proxyList = fs.readFileSync('proxylist.txt', 'utf-8').split('\n').map(proxy => proxy.trim()).filter(Boolean);
}

const userAgents = fs.readFileSync('useragents.txt', 'utf-8').split('\n').map(agent => agent.trim().replace(/[^\x20-\x7E]/g, '')).filter(Boolean); // Split new line, remove invalid characters, and remove empty strings

const cartedItems = new Map();
const cartTimeout = 10 * 60 * 1000;

const monitorTimout = 15 * 60 * 1000;
let campsiteCarted = false;

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
  if (campsiteCarted) {
    return;
  }

  clearExpiredCartedItems();

  const userAgent = getRandomUserAgent();
  let proxyConfig = null;

  if (config.proxies == 1) {
    const proxy = getRandomProxy();
    const [host, port] = proxy.split(':');
    proxyConfig = { host, port: parseInt(port), protocol: 'http' };
  }

  const year = startDate.split('-')[0];
  const month = startDate.split('-')[1];

  const start_date = `${year}-${month}-01T00:00:00.000Z`;

  const axiosConfig = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `https://www.recreation.gov/api/camps/availability/campground/${campgroundId}/month?start_date=${encodeURIComponent(start_date)}`,
    headers: {
      'User-Agent': userAgent
    },
    ...(proxyConfig && { proxy: proxyConfig })
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

            if (date === startDate + 'T00:00:00Z') {
              console.log(`${campgroundName} is available on ${formattedDate}`);

              if (config.discordWebhook) {
                sendWebhook(`${campgroundName} is available on ${formattedDate} - <https://www.recreation.gov/camping/campsites/${campsiteId}>`);
              }

              cart(campsiteId, date, campgroundName);
              cartedItems.set(itemKey, Date.now());

              campsiteCarted = true;

              setTimeout(() => {
                campsiteCarted = false;
                console.log('Resuming monitoring after 15 minutes...');
              }, monitorTimout);

              return;
            }
          }
        }
      }
    })
    .catch((e) => {
      console.log('Error: ' + e);
    });
}

function mainMonitor() {
  if (campsiteCarted) {
    return;
  }

  for (let i = 0; i < config.campsites.length; i++) {
    monitor(config.campsites[i].campgroundId, config.campsites[i].campgroundName, config.campsites[i].startDate);
  }
}

setInterval(mainMonitor, 5000);