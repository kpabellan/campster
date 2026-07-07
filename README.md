# Campster

Campster is a campsite reservation helper that monitors and secures available campsites on [recreation.gov](https://www.recreation.gov/).

## Configuration

### Prerequisites and Requirements

1. **Node.js Installation**: Ensure Node.js is installed on your system. You can download it [here](https://nodejs.org/en/download/package-manager).
   
2. **Browser Access**: This project uses Puppeteer to automate actions by connecting to an already-running Chrome instance over the remote debugging port. You must keep that Chrome window open while the program is running.

   **Fully close all existing Chrome windows first.** If any Chrome process is already running, a new launch just opens a tab in the existing process and ignores the flags below. On Windows you can force this with `taskkill /F /IM chrome.exe`.

   Then launch Chrome with **both** flags:

   ```sh
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\ChromeDebug"
   ```

   > **Note:** Since Chrome 136, `--remote-debugging-port` is silently ignored unless you also pass a non-default `--user-data-dir`. The path above (`C:\ChromeDebug`) is a fresh, isolated profile — Chrome creates it automatically. Because it's a new profile you'll be signed out, so **sign in to recreation.gov once** in that window before running the program. (If you'd rather reuse your normal logins, point `--user-data-dir` at your real profile root, e.g. `C:\Users\<you>\AppData\Local\Google\Chrome\User Data`, but then no other Chrome window can be open using that profile.)

   You can save the command as a desktop shortcut: right-click the shortcut → Properties → set the **Target** to the full command above.

3. **Verify Setup**: In that Chrome window, go to [http://127.0.0.1:9222/json/version](http://127.0.0.1:9222/json/version). If you see JSON information about your browser, the setup is complete. If the page fails to connect, the debugging port isn't open — recheck the steps above.

### Proxies

Proxies are used to reduce the likelihood of hitting rate limits on the API.

1. Open the proxylist.txt file in the main folder.
2. Enter your proxies, each on a new line, as `host:port` or `host:port:user:pass`.
3. In the src/config.js file, make sure the proxies field is set to `true` to enable proxy usage.
4. If you set proxies to `false`, the program will not use proxies. This is not recommended for prolonged use as it increases the risk of being rate-limited or blocked.

### User Information

You need to provide some personal information for this program to run. All information is stored locally on your machine — `src/config.js` is gitignored so your credentials are never committed.

1. Copy `src/config.example.js` to `src/config.js`.
2. Open `src/config.js` and enter the required information in the appropriate fields.
3. To get the `campgroundId`, navigate to the campground page on [recreation.gov](https://www.recreation.gov/). The URL will look like `https://www.recreation.gov/camping/campgrounds/123456`. The "123456" part of the URL is the `campgroundId` for that campground.
4. The `campgroundName` can be any string and is mainly used for logs. It's recommended to use the actual name of the campground to make alerts and logs more readable.
5. The `startDate` should be in the format `YYYY-MM-DD` (zero-padded, e.g. `2026-08-01`) and represents the night you plan to reserve. The program carts that night; you can modify the dates once the campsite is in the cart.
6. `targetSites` (optional) is a list of specific site numbers to snipe within the campground, e.g. `["A01"]`. Enter them as they appear on the recreation.gov campground map. Matching is tolerant of the labeling differences between campgrounds: case, punctuation, and leading zeros are ignored (`"a1"` matches `A01`), type prefixes are ignored (`"12"` matches `TENT NONELECTRIC 012`), and loop letters work whether the campground stores them in the site name or in a separate loop field (`"A01"` matches site `001` in loop `A`). If `targetSites` is omitted or empty, the program reserves any open site in the campground, as before.

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

Due to this limitation, it is recommended that you set up a Discord webhook to receive alerts when a campsite has been successfully added to your cart. This way, you can be notified immediately and complete the reservation before the time expires.

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