# Smut Wrapped

**Your AO3 Year in Review** - A Spotify Wrapped-style visualization of your Archive of Our Own reading history.

## What is Smut Wrapped?

Smut Wrapped is a desktop application that generates beautiful, shareable statistics about your AO3 reading habits. Just like Spotify Wrapped shows your music taste, Smut Wrapped reveals your fic preferences - your favorite fandoms, ships, tropes, and more!

**Your data never leaves your device. We never see your password, your history, or your stats.**

---

## Features

- **Total Reading Stats** - Words read, works consumed, time spent in fandom
- **Top Fandoms** - Your most-read fandoms of the year
- **Favorite Ships** - The pairings you couldn't get enough of
- **Beloved Tropes** - Your go-to tags and themes
- **Most-Read Authors** - The writers you keep coming back to
- **Rating Breakdown** - Your G to E distribution (no judgment!)
- **Hidden Gems** - Low-kudos works you loved
- **Longest Reads** - Your epic fic journeys
- **And more!**

All presented in beautiful, shareable slides you can download and post to social media.

---

## Download

### Pre-built Releases

Download the latest release for your platform:

- **Windows**: `smut-wrapped-Setup-1.0.0.exe`
- **macOS**: `smut-wrapped-1.0.0.dmg`
- **Linux**: `smut-wrapped-1.0.0.AppImage`

[Download from Releases](#) <!-- Add actual release link -->

### Build from Source

If you prefer to build from source (recommended for the privacy-conscious):

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

---

## How to Use

1. **Download and open** Smut Wrapped
2. **Click "Get Started"** on the welcome screen
3. **Log into AO3** in the embedded browser
4. **Click "Start My Wrapped!"** when logged in
5. **Wait** while we respectfully gather your reading history
6. **Enjoy** your personalized Wrapped presentation!
7. **Download** your favorite slides to share

### Navigation

- **Arrow keys** or **swipe** to navigate between slides
- **Download This Slide** - Save the current slide as an image
- **Download All Slides** - Save all slides for sharing

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

For a typical reading history:
- ~50 works: ~5 minutes
- ~200 works: ~20 minutes
- ~500 works: ~45 minutes

### Is the app safe to use?

The app is completely open source. You can:
1. Read every line of code in this repository
2. Build it yourself from source
3. Run it in development mode to inspect network requests

There are no hidden behaviors, no phone-home features, and no data collection.

### Why "Smut Wrapped"?

It's a playful nod to the fact that many AO3 readers enjoy... spicier content. But the app works perfectly for readers of all ratings! We calculate stats for all ratings, not just Explicit.

### Can I use this for someone else's account?

No, and please don't. This tool is designed for personal use only. Accessing another person's account without permission would violate both AO3's ToS and basic internet ethics.

### My history is huge - will it work?

The app handles large histories, but will take longer. For very large histories (1000+ works), you may want to run it overnight. Progress is shown in real-time so you can monitor.

### What if a work was deleted?

Works that have been deleted or made private will be skipped. The final stats will note how many works couldn't be loaded.

### Can I customize what year/timeframe to analyze?

Currently, Smut Wrapped analyzes your entire reading history. Date-range filtering is planned for a future update.

---

## Privacy Policy

**TL;DR: We collect nothing. Zero. Zilch.**

### Detailed Privacy Information

1. **Authentication**: You log into AO3 directly in an embedded browser. Your credentials are handled by AO3's servers, not ours. The app uses session cookies that are cleared when you close the app.

2. **Data Processing**: All scraping and analysis happens locally on your device. No external servers are contacted except AO3 itself.

3. **Storage**: Nothing is permanently stored. When you close the app, all data is cleared.

4. **Network Requests**: The only network requests are to archiveofourown.org to fetch your reading history. You can verify this by monitoring network traffic.

5. **Analytics/Tracking**: None. No Google Analytics, no Mixpanel, no telemetry, no error reporting services.

---

## Technical Details

### Stack
- **Electron** - Cross-platform desktop framework
- **Vanilla JS** - No heavy frameworks needed
- **html2canvas** - For slide image generation

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

### Rate Limiting

The scraper enforces a **minimum 5-second delay** between all requests to AO3. This is intentional and will not be reduced. AO3 is a non-profit running on donations - we must be respectful.

### Security

- Context isolation enabled
- Node integration disabled
- Preload script provides minimal API surface
- No remote code execution
- All cookies cleared on app close

---

## Building Icons

The app uses `assets/icon.svg` as the source. To generate platform-specific icons:

```bash
# Install icon generator
npm install -g electron-icon-builder

# Generate icons
electron-icon-builder --input=assets/icon.svg --output=assets
```

Or manually create:
- `icon.ico` (Windows) - 256x256 multi-resolution
- `icon.icns` (macOS) - Required sizes: 16, 32, 64, 128, 256, 512, 1024
- `icon.png` (Linux) - 512x512 or 1024x1024

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Guidelines

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

[Open an issue](https://github.com/yourusername/smut-wrapped/issues)

---

Made with love for the fandom community.
