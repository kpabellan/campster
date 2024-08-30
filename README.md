# Campster

Campster is a campsite reservation helper that monitors and secures available campsites on [recreation.gov](https://www.recreation.gov/).

## Configuration

### Prerequisites and Requirements

1. **Node.js Installation**: Ensure Node.js is installed on your system. You can download it [here](https://nodejs.org/en/download/package-manager).
   
2. **Browser Access**: This project uses Puppeteer to automate actions and requires access to your browser. You must keep the browser window open while the program is running. To set this up, change the Google Chrome properties target to:  
   `"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222`.

3. **Verify Setup**: Open Google Chrome and go to [http://127.0.0.1:9222/json/version](http://127.0.0.1:9222/json/version). If you see information regarding your browser, the setup is complete.

### Proxies

Proxies are required to reduce the likelihood of hitting rate limits on the API.

1. Open the `proxylist.txt` file in the main folder.
2. Enter your proxies, each on a new line.

### User Information

You need to provide some personal information for this program to run. All information is stored locally on your machine.

1. Open the `config.js` file.
2. Enter the required information in the appropriate fields.
3. To get the `campgroundId`, navigate to the campground page on [recreation.gov](https://www.recreation.gov/). The URL will look like `https://www.recreation.gov/camping/campgrounds/123456`. The "123456" part of the URL is the `campgroundId` for that campground.
4. The `campgroundName` can be any string and is mainly used for logs. It's recommended to use the actual name of the campground to make alerts and logs more readable.
5. The `startDate` should be in the format `YYYY-MM-DD` and represents the day you plan to reserve. The program will automatically reserve all available days starting from the `startDate`. You can modify these dates once the campground is in the cart.

## Starting

To start the program, open a terminal and run these commands:

* Set directory to program directory:
  ```sh
  cd "C:/Path/To/Program/Folder"
  ```
* Install the dependencies (you only have to do this once):
  ```sh
  npm install
  ```
* Run with the following command:
  ```sh
  npm start
  ```

## Limitations

The checkout process is **NOT** automated. The program adds the campsite to the cart, giving you 15 minutes to manually modify and input your information to complete the checkout.

## Disclaimer and Liability Notice

**This project is for educational and research purposes only.** Using this code for scraping, crawling, or automating interactions with websites may violate the Terms of Service of those websites and could result in legal consequences. By using this code, you agree to comply with all relevant terms, policies, and laws.

### Important Legal Warnings

- **No Warranty**: This software is provided "as is," without any warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. The authors and contributors of this project are not liable for any claims, damages, or liabilities arising from the use of this software.

- **Limitation of Liability**: The authors shall not be held liable for any damages, direct or indirect, resulting from the use of this software. This includes, but is not limited to, loss of data, revenue, or any other damages resulting from legal disputes, breaches of terms of service, or other violations.

- **User Responsibility**: By using this code, you are solely responsible for ensuring compliance with all applicable laws, regulations, and website terms of service. The authors of this code do not condone or support its use in any illegal or unauthorized manner. It is strongly advised that you obtain explicit permission from website owners before using any scraping, crawling, or automation techniques.

### Compliance with Laws and Terms

It is the user's responsibility to ensure that their use of this software does not violate any local, state, federal, or international laws. This includes, but is not limited to, compliance with data protection, privacy, intellectual property laws, and specific terms and conditions set by individual websites. If you are unsure whether your use of this software is permissible, consult legal counsel before proceeding.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.