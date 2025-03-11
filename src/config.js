const config = {
  "profile": {
    "email": "",
    "password": ""
  },
  "campsites": [
    {
      "campgroundId": "232447", // Campground ID
      "campgroundName": "Upper Pines", // Campground name
      "startDate": "2025-01-01" // Target date in format YYYY-MM-DD
    },
    {
      "campgroundId": "232450",
      "campgroundName": "Lower Pines",
      "startDate": "2025-01-01"
    },
    {
      "campgroundId": "232449",
      "campgroundName": "North Pines",
      "startDate": "2025-01-11"
    }
  ],
  "proxies": 1, // Set to 0 to disable proxies (not recommended)
  "discordWebhook": "" // Discord webhook (optional)
};

module.exports = config;