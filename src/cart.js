const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const config = require('./config');
const { sendWebhook, formatDate } = require('./helper');

const delay = (time) => new Promise(resolve => setTimeout(resolve, time));

puppeteer.use(StealthPlugin());

async function connectToExistingBrowser() {
  let response;
  try {
    response = await axios.get('http://127.0.0.1:9222/json/version');
  } catch (error) {
    throw new Error(
      'Could not reach Chrome on port 9222. Make sure Chrome is running with ' +
      '--remote-debugging-port=9222 and a non-default --user-data-dir. ' +
      'See the README for setup. (' + error.message + ')'
    );
  }

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
    console.log(`Could not select ${formattedDate} on the calendar (it may no longer be available): ${error.message}`);
  }

  try {
    await page.waitForSelector('#add-cart-campsite');
    await page.$eval('#add-cart-campsite', el => el.click());
    console.log('Campsite added to cart.');
  } catch (error) {
    console.log(`Could not click the "Add to Cart" button: ${error.message}`);
  }

  await checkProceedButton(page);

  try {
    await page.waitForSelector('#email', { timeout: 1000 });
    await page.type('#email', config.profile.email);

    await page.waitForSelector('#password');
    await page.type('#password', config.profile.password);

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
    // #email not appearing within 1s usually means we're already logged in.
    // Log the reason so a genuine login failure isn't silently masked as "logged in".
    console.log(`Login form skipped (already logged in, or login failed): ${error.message}`);
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