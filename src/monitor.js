const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const path = require('path');
const { cart } = require('./cart');
const config = require('./config');
const { sendWebhook, formatDate, siteMatchesTarget } = require('./helper');

function readListFile(filename) {
  // Resolve against the project root so the program works no matter where it is launched from.
  const filePath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(filePath)) {
    console.error(`Required file "${filename}" was not found at ${filePath}. Create it and try again.`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

const proxiesEnabled = Boolean(config.proxies);

let proxyList = [];
if (proxiesEnabled) {
  proxyList = readListFile('proxylist.txt').split('\n').map(proxy => proxy.trim()).filter(Boolean);
  if (proxyList.length === 0) {
    console.error('Proxies are enabled (config.proxies) but "proxylist.txt" is empty. Add proxies or set config.proxies to false.');
    process.exit(1);
  }
  for (const proxy of proxyList) {
    const parts = proxy.split(':');
    if ((parts.length !== 2 && parts.length !== 4) || !/^\d+$/.test(parts[1])) {
      console.error(`Invalid line in proxylist.txt: "${proxy}". Expected "host:port" or "host:port:user:pass".`);
      process.exit(1);
    }
  }
}

const userAgents = readListFile('useragents.txt').split('\n').map(agent => agent.trim().replace(/[^\x20-\x7E]/g, '')).filter(Boolean); // Split new line, remove invalid characters, and remove empty strings

if (userAgents.length === 0) {
  console.error('"useragents.txt" is empty. Add at least one user agent string.');
  process.exit(1);
}

function validateConfig() {
  if (!Array.isArray(config.campsites) || config.campsites.length === 0) {
    console.error('config.campsites must be a non-empty array. See src/config.example.js.');
    process.exit(1);
  }

  const todayUtc = new Date().toISOString().slice(0, 10);

  for (const entry of config.campsites) {
    const label = entry.campgroundName || entry.campgroundId || JSON.stringify(entry);

    if (!/^\d+$/.test(String(entry.campgroundId))) {
      console.error(`Invalid campgroundId for "${label}": expected the numeric ID from the campground's recreation.gov URL.`);
      process.exit(1);
    }
    // The availability check compares date strings exactly, so a non-zero-padded or
    // past date would otherwise never match and fail silently forever.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.startDate)) || isNaN(new Date(`${entry.startDate}T00:00:00Z`))) {
      console.error(`Invalid startDate "${entry.startDate}" for "${label}": expected zero-padded YYYY-MM-DD, e.g. "2026-08-01".`);
      process.exit(1);
    }
    if (entry.startDate < todayUtc) {
      console.error(`startDate "${entry.startDate}" for "${label}" is in the past.`);
      process.exit(1);
    }
    if (entry.targetSites !== undefined && !Array.isArray(entry.targetSites)) {
      console.error(`targetSites for "${label}" must be an array of site labels, e.g. ["A01"].`);
      process.exit(1);
    }
  }

  if (!config.profile || !config.profile.email || !config.profile.password) {
    console.warn('Warning: profile email/password is empty in src/config.js. Carting will only work if the Chrome window is already logged in to recreation.gov.');
  }
}

const cartedItems = new Map();
const cartTimeout = 10 * 60 * 1000;

const monitorTimeout = 15 * 60 * 1000;
let campsiteCarted = false;

// Campgrounds with a request currently in flight, so a slow response (or a 429 retry chain)
// doesn't stack duplicate requests on the next 5-second tick.
const inFlightCampgrounds = new Set();

// Campgrounds whose targetSites have been checked against a real availability response,
// so config typos that match nothing are warned about exactly once.
const checkedTargetCampgrounds = new Set();

function getRandomProxy() {
  const randomIndex = Math.floor(Math.random() * proxyList.length);
  return proxyList[randomIndex];
}

function getRandomUserAgent() {
  const randomIndex = Math.floor(Math.random() * userAgents.length);
  return userAgents[randomIndex];
}

// Axios's built-in `proxy` option does not reliably tunnel to HTTPS destinations through
// HTTP proxies, so build an explicit CONNECT-tunneling agent instead.
function buildProxyInfo() {
  if (!proxiesEnabled) {
    return null;
  }
  const proxy = getRandomProxy();
  // Support both "host:port" and per-proxy "host:port:user:pass" formats.
  const [host, port, user, pass] = proxy.split(':');

  let auth = '';
  if (user && pass) {
    // Credentials embedded in the proxy line.
    auth = `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`;
  } else if (config.proxyAuth && config.proxyAuth.username) {
    // Shared credentials for all proxies, kept in config.js (gitignored).
    auth = `${encodeURIComponent(config.proxyAuth.username)}:${encodeURIComponent(config.proxyAuth.password)}@`;
  }

  return {
    agent: new HttpsProxyAgent(`http://${auth}${host}:${port}`),
    label: `${host}:${port}`
  };
}

// How many times to retry a request that gets rate-limited (429), each time with a fresh proxy.
const maxRetries = 3;
const retryDelay = 750;

function clearExpiredCartedItems() {
  const now = Date.now();
  for (const [itemKey, timestamp] of cartedItems.entries()) {
    if (now - timestamp > cartTimeout) {
      cartedItems.delete(itemKey);
      console.log(`Cleared carted item: ${itemKey}`);
    }
  }
}

function monitor(campgroundId, campgroundName, startDate, targetSites, retryCount = 0) {
  if (retryCount === 0) {
    if (campsiteCarted || inFlightCampgrounds.has(campgroundId)) {
      return;
    }
    inFlightCampgrounds.add(campgroundId);
  } else if (campsiteCarted) {
    inFlightCampgrounds.delete(campgroundId);
    return;
  }

  clearExpiredCartedItems();

  // If targetSites is a non-empty list, only those sites are sniped; otherwise any open site is fair game.
  const hasTargetSites = Array.isArray(targetSites) && targetSites.length > 0;

  const [year, month] = startDate.split('-');
  const start_date = `${year}-${month}-01T00:00:00.000Z`;
  const targetDateKey = `${startDate}T00:00:00Z`;

  const proxyInfo = buildProxyInfo();

  const axiosConfig = {
    method: 'get',
    maxBodyLength: Infinity,
    timeout: 10000,
    url: `https://www.recreation.gov/api/camps/availability/campground/${campgroundId}/month?start_date=${encodeURIComponent(start_date)}`,
    headers: {
      'User-Agent': getRandomUserAgent()
    },
    ...(proxyInfo && { httpsAgent: proxyInfo.agent, proxy: false })
  };

  const requestLabel = `${campgroundName} (${campgroundId}) for ${month}/${year}` +
    (proxyInfo ? ` via proxy ${proxyInfo.label}` : ' (no proxy)');
  console.log(`[${new Date().toISOString()}] Requesting availability: ${requestLabel}`);

  axios.request(axiosConfig)
    .then((response) => {
      inFlightCampgrounds.delete(campgroundId);
      console.log(`[${new Date().toISOString()}] Response ${response.status} for ${requestLabel}`);

      // Another campground's response may have carted a site while this request was in flight.
      if (campsiteCarted) {
        return;
      }

      const campsites = response.data.campsites || {};

      if (hasTargetSites && !checkedTargetCampgrounds.has(campgroundId)) {
        checkedTargetCampgrounds.add(campgroundId);
        const allSites = Object.values(campsites);
        const unmatched = targetSites.filter(target => !allSites.some(cs => siteMatchesTarget(target, cs.site, cs.loop)));
        if (unmatched.length > 0) {
          console.warn(`Warning: these targetSites for ${campgroundName} match no site in the campground: ${unmatched.join(', ')}. Check the site labels on recreation.gov.`);
        }
      }

      for (const campsiteId in campsites) {
        const campsite = campsites[campsiteId];
        const siteName = campsite.site;

        if (hasTargetSites && !targetSites.some(target => siteMatchesTarget(target, siteName, campsite.loop))) {
          continue;
        }

        const availability = (campsite.availabilities || {})[targetDateKey];
        const itemKey = `${campsiteId}-${targetDateKey}`;

        if ((availability === 'Available' || availability === 'Open') && !cartedItems.has(itemKey)) {
          const formattedDate = formatDate(targetDateKey);
          console.log(`${campgroundName} site ${siteName} is available on ${formattedDate}`);

          if (config.discordWebhook) {
            sendWebhook(`${campgroundName} site ${siteName} is available on ${formattedDate} - <https://www.recreation.gov/camping/campsites/${campsiteId}>`);
          }

          cartedItems.set(itemKey, Date.now());
          campsiteCarted = true;

          const resumeTimer = setTimeout(() => {
            campsiteCarted = false;
            console.log('Resuming monitoring after 15 minutes...');
          }, monitorTimeout);

          cart(campsiteId, targetDateKey, campgroundName).catch((e) => {
            // Carting failed (e.g. Chrome debugger not reachable, or checkout never confirmed).
            // Forget the item and resume monitoring immediately so the site can be retried.
            console.log('Carting failed: ' + e.message);
            cartedItems.delete(itemKey);
            clearTimeout(resumeTimer);
            campsiteCarted = false;
          });

          return;
        }
      }
    })
    .catch((e) => {
      const status = e.response ? `HTTP ${e.response.status}` : (e.code || 'no response');
      console.log(`[${new Date().toISOString()}] Request failed (${status}) for ${requestLabel}: ${e.message}`);

      // 429 = rate-limited on that proxy IP. Retry shortly with a fresh proxy; the campground
      // stays marked in-flight so the 5-second tick doesn't stack a duplicate request.
      if (e.response && e.response.status === 429 && retryCount < maxRetries) {
        console.log(`[${new Date().toISOString()}] Retrying (${retryCount + 1}/${maxRetries}) with a different proxy...`);
        setTimeout(() => monitor(campgroundId, campgroundName, startDate, targetSites, retryCount + 1), retryDelay);
        return;
      }

      inFlightCampgrounds.delete(campgroundId);
    });
}

function mainMonitor() {
  if (campsiteCarted) {
    return;
  }

  for (let i = 0; i < config.campsites.length; i++) {
    monitor(config.campsites[i].campgroundId, config.campsites[i].campgroundName, config.campsites[i].startDate, config.campsites[i].targetSites);
  }
}

validateConfig();
setInterval(mainMonitor, 5000);