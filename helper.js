const axios = require('axios');
const config = require('./config');

const options = { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric',
  timeZone: 'UTC'
};

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', options);
}

async function sendWebhook(message) {
  try {
    await axios.post(config.discordWebhook, {
      content: message
    });
  } catch (error) {
    console.error('Error sending webhook message:', error);
  }
}

module.exports = {
  formatDate,
  sendWebhook
};