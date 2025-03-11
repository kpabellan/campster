const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const config = require('./config');
const { sendWebhook, formatDate } = require('./helper');

const delay = (time) => new Promise(resolve => setTimeout(resolve, time));

puppeteer.use(StealthPlugin());

async function connectToExistingBrowser() {
  const response = await axios.get('http://127.0.0.1:9222/json/version');
  const { webSocketDebuggerUrl } = response.data;

  const browser = await puppeteer.connect({
    browserWSEndpoint: webSocketDebuggerUrl,
    defaultViewport: null,
  });

  return browser;
}

async function checkProceedButton(page) {
  try {
    await page.waitForSelector('.sarsa-button-content', { timeout: 1000 });

    await page.evaluate(() => {
      const elements = document.querySelectorAll('.sarsa-button-content');
      for (let element of elements) {
        if (element.innerText.trim() === 'Proceed with Reservation') {
          element.click();
          break;
        }
      }
    });

    await delay(3000);
  } catch (error) {
    // "Proceed with Reservation" button not found
  }
}

async function cart(siteId, date, campgroundName) {
  const browser = await connectToExistingBrowser();
  const page = await browser.newPage();

  const formattedDate = formatDate(date);

  console.log('Adding campsite to cart...');

  await page.goto(`https://www.recreation.gov/camping/campsites/${siteId}`);

  // Simulate scrolling
  await page.evaluate(() => window.scrollBy(0, window.innerHeight / 2));

  try {
    await page.waitForSelector(`[aria-label="${formattedDate} - Available"]`, { timeout: 1000 });
    await page.$eval(`[aria-label="${formattedDate} - Available"]`, el => el.click());
    await page.$eval('[class="calendar-cell is-styled-day checkout"]', el => el.click());
  } catch (error) {
    // Campsite is no longer available
  }

  try {
    await page.waitForSelector('#add-cart-campsite');
    await page.$eval('#add-cart-campsite', el => el.click());
    console.log('Campsite added to cart.');
  } catch (error) {
    // Error adding campsite to cart
  }

  await checkProceedButton(page);

  try {
    await page.waitForSelector('#email', { timeout: 1000 });
    await page.type('#email', config.profile.email);

    await page.waitForSelector('#rec-acct-sign-in-password');
    await page.type('#rec-acct-sign-in-password', config.profile.password);

    await page.waitForSelector('.sarsa-button-content');

    await page.evaluate(() => {
      const elements = document.querySelectorAll('.sarsa-button-content');
      for (let element of elements) {
        if (element.innerText.trim() === 'Log In') {
          element.click();
          break;
        }
      }
    });

    await checkProceedButton(page);

    try {
      await page.waitForSelector('#add-cart-campsite', { timeout: 1500 });
      await page.$eval('#add-cart-campsite', el => el.click());
    } catch (error) {
      console.log(error);
    }
  } catch (error) {
    // Already logged in
  }

  try {
    await delay(1000);
  
    const currentUrl = page.url();
    if (currentUrl.includes('orderdetails')) {
      console.log(`Reserved ${campgroundName} for ${formattedDate}.`);
  
      if (config.discordWebhook) {
        sendWebhook(`Reserved ${campgroundName} for ${formattedDate} - Finish checkout at <https://www.recreation.gov/cart>`);
      }
    } else {
      console.log('Failed to reach the order details page.');
    }
  } catch (error) {
    console.log('Error:', error.message);
  }

  await delay(3000);
  await page.close();
}

module.exports = {
  cart
};