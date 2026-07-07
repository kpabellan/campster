const axios = require('axios');

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

// Split a site label into letter and number tokens, e.g. "A-01" -> ["A", 1].
// Numbers are parsed so "01" and "1" compare equal; case and punctuation are ignored.
function tokenizeSiteName(name) {
  const raw = String(name == null ? '' : name).toUpperCase().match(/[A-Z]+|\d+/g) || [];
  return raw.map(token => (/^\d/.test(token) ? parseInt(token, 10) : token));
}

function tokensEndWith(tokens, suffix) {
  if (suffix.length === 0 || suffix.length > tokens.length) {
    return false;
  }
  const offset = tokens.length - suffix.length;
  return suffix.every((token, i) => tokens[offset + i] === token);
}

// True if a user-entered target label refers to this campsite. Campgrounds label sites
// inconsistently, so the target must match as a suffix of the site label, or of the
// loop + site labels combined. This handles leading zeros ("A01" vs "A1"), punctuation
// and case ("a-1"), type prefixes ("TENT NONELECTRIC 012"), and campgrounds that keep
// the loop letter in a separate field (site "001" in loop "A").
function siteMatchesTarget(target, site, loop) {
  const targetTokens = tokenizeSiteName(target);
  if (targetTokens.length === 0) {
    return false;
  }
  const siteTokens = tokenizeSiteName(site);
  return tokensEndWith(siteTokens, targetTokens) ||
    tokensEndWith(tokenizeSiteName(loop).concat(siteTokens), targetTokens);
}

async function sendWebhook(message) {
  try {
    const config = require('./config');
    await axios.post(config.discordWebhook, {
      content: message
    });
  } catch (error) {
    console.error('Error sending webhook message:', error.message);
  }
}

module.exports = {
  formatDate,
  sendWebhook,
  siteMatchesTarget
};