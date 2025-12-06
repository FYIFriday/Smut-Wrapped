# Smut Wrapped

**Your AO3 Year in Review** - A Spotify Wrapped-style visualization of your Archive of Our Own reading history.

## What is Smut Wrapped?

Smut Wrapped is a desktop application that generates beautiful, shareable statistics about your AO3 reading habits. Just like Spotify Wrapped shows your music taste, Smut Wrapped reveals your fic preferences - your favorite fandoms, ships, tropes, and more!

**Your data never leaves your device. We never see your password, your history, or your stats.**

---

## Download & Install

**No technical knowledge required!** Just download, install, and run.

### Windows

1. Download `Smut-Wrapped-Setup.exe` from the [Releases page](../../releases/latest)
2. Double-click the downloaded file
3. Follow the installer prompts
4. Launch "Smut Wrapped" from your Start Menu or Desktop

### macOS

1. Download `Smut-Wrapped.dmg` from the [Releases page](../../releases/latest)
2. Double-click the downloaded file
3. Drag "Smut Wrapped" to your Applications folder
4. Launch from Applications (you may need to right-click → Open the first time)

---

## How to Use

1. **Open** Smut Wrapped
2. **Click "Get Started"** on the welcome screen
3. **Log into AO3** in the app's built-in browser
4. **Click "Start My Wrapped!"** when logged in
5. **Wait** while your stats are generated (this takes a while - we're respectful of AO3's servers!)
6. **Enjoy** your personalized Wrapped slides!
7. **Download** your slides to share on social media

### Navigation

- Use **arrow keys** or **swipe** to move between slides
- Click **"Download This Slide"** to save the current slide as an image
- Click **"Download All Slides"** to save everything for sharing

---

## Features

- **Total Reading Stats** - Words read, works consumed, equivalent novels
- **Top Fandoms** - Your most-read fandoms of the year
- **Favorite Ships** - The pairings you couldn't get enough of
- **Beloved Tropes** - Your go-to tags and themes
- **Most-Read Authors** - The writers you keep coming back to
- **Rating Breakdown** - Your G to E distribution (no judgment!)
- **Hidden Gems** - Low-kudos works you loved
- **Longest Reads** - Your epic fic journeys
- **Smut Percentage** - How spicy is your reading taste?
- **Fluff vs Angst** - Are you a comfort reader or do you like pain?
- **And more!**

All presented in beautiful slides you can download and share on social media.

---

## FAQ

### Is this allowed by AO3?

**Yes.** AO3's Terms of Service allow personal use of your own data. Smut Wrapped:
- Only accesses your reading history (data that's already yours)
- Uses respectful rate limiting (5+ seconds between requests)
- Identifies itself as a bot in requests
- Never scrapes other users' data
- Doesn't store or share any data

### Do you see my data?

**Absolutely not.** Smut Wrapped runs entirely on your computer. Your AO3 credentials, reading history, and generated statistics never leave your device. There are:
- No servers
- No analytics
- No tracking
- No cloud storage
- No data collection of any kind

You can verify this by reading the source code - it's all here in this repository.

### Why is it so slow?

We deliberately add a **5-second delay** between each request to AO3. This is non-negotiable - AO3 runs on donated servers and serves millions of fans. We will not contribute to server load.

Estimated times based on history size:
- ~50 works: ~5 minutes
- ~200 works: ~20 minutes
- ~500 works: ~45 minutes

You can leave it running in the background while you do other things!

### Is the app safe to use?

Yes! The app is:
- **Open source** - Every line of code is visible in this repository
- **Privacy-first** - No data ever leaves your computer
- **Sandboxed** - Runs in an isolated environment
- **Self-cleaning** - All session data is erased when you close the app

### Why "Smut Wrapped"?

It's a playful nod to the fact that many AO3 readers enjoy... spicier content. But the app works perfectly for readers of all ratings! We calculate stats for all ratings, not just Explicit.

### Can I use this for someone else's account?

No, and please don't. This tool is designed for personal use only. Accessing another person's account without permission would violate both AO3's ToS and basic internet ethics.

### My history is huge - will it work?

The app handles large histories, but will take longer. For very large histories (1000+ works), you may want to run it overnight. Progress is shown in real-time so you can monitor.

### What if a work was deleted?

Works that have been deleted or made private will be skipped. The final stats will note how many works couldn't be loaded.

### Windows says the app is from an "unknown publisher"

This is normal for free/open-source software that hasn't paid for a code signing certificate ($400+/year). Click "More info" → "Run anyway" to proceed. The app is safe - you can verify by reading the source code.

### macOS says the app is from an "unidentified developer"

Right-click the app → click "Open" → click "Open" again. This is Apple's security for apps not from the App Store. The app is safe to use.

---

## Privacy Policy

**TL;DR: We collect nothing. Zero. Zilch.**

1. **Authentication**: You log into AO3 directly in an embedded browser. Your credentials are handled by AO3's servers only. The app uses session cookies that are cleared when you close the app.

2. **Data Processing**: All scraping and analysis happens locally on your device. No external servers are contacted except AO3 itself.

3. **Storage**: Nothing is permanently stored. When you close the app, all data is cleared.

4. **Network Requests**: The only network requests are to archiveofourown.org to fetch your reading history.

5. **Analytics/Tracking**: None. No Google Analytics, no telemetry, no error reporting.

---

## For Developers

### Building from Source

If you want to build the app yourself (for extra peace of mind about privacy):

```bash
# Clone the repository
git clone https://github.com/yourusername/smut-wrapped.git
cd smut-wrapped

# Install dependencies
npm install

# Run in development mode
npm start

# Build for your platform
npm run build
```

### Project Structure

```
smut-wrapped/
├── main.js           # Electron main process
├── preload.js        # Security bridge
├── index.html        # UI screens
├── styles.css        # Styling
├── app.js            # Application logic
├── scraper.js        # AO3 scraping
├── analyzer.js       # Statistics calculation
├── visualizer.js     # Slide generation
├── package.json      # Dependencies & build config
└── assets/
    └── icon.svg      # App icon source
```

### Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

**Important guidelines:**
- Maintain the 5-second rate limit - this is non-negotiable
- Keep data local - no external services
- Test with both small and large reading histories
- Preserve privacy-first design

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Credits

- Built by the fandom, for the fandom
- Inspired by Spotify Wrapped
- Made possible by AO3 and the OTW

**AO3/OTW Disclaimer**: This is an unofficial fan project. It is not affiliated with, endorsed by, or connected to the Organization for Transformative Works (OTW) or Archive of Our Own (AO3).

---

## Support

Found a bug? Have a feature request?

[Open an issue](../../issues)

---

Made with love for the fandom community.
