<p align="center">
  <img src="logo.png" alt="PixelPaletteSwap Logo" width="120">
</p>

<h1 align="center">PixelPaletteSwap</h1>

<p align="center">
  <strong>Free online tool to swap colors in pixel art GIFs and images</strong>
</p>

<p align="center">
  <a href="http://pixelpaletteswap.com/">🌐 Live Demo</a> •
  <a href="#features">✨ Features</a> •
  <a href="#how-it-works">📖 How It Works</a> •
  <a href="#running-locally">🚀 Run Locally</a>
</p>

---

## 🎨 About

PixelPaletteSwap is a browser-based tool for swapping colors in pixel art. Perfect for **game developers**, **pixel artists**, and **sprite designers** who want to create color variations of their characters and assets without redrawing.

**🔒 Privacy First:** All processing happens locally in your browser. Your images never leave your computer.

## ✨ Features

- **GIF Support** - Load animated GIFs and edit all frames at once
- **Image Sequences** - Upload multiple PNGs as animation frames
- **Color Picker** - Click directly on the image to select colors
- **Color Grouping** - Group colors to change gradient colors at once
- **Selection Tools** - Rectangle or polygon selection to swap colors in specific areas
- **Palette Import** - Upload a second image to use its colors as swap targets
- **Live Preview** - See changes in real-time with animation playback
- **Zoom Control** - Pixel-perfect viewing at any scale (Ctrl+scroll to zoom)
- **Save Presets** - Export color mappings as JSON to reuse on other sprites
- **ZIP Export** - Download PNG sequences as a convenient ZIP file

## 📖 How It Works

1. **Upload** your pixel art GIF, PNG, or multiple images
2. **View** the automatically extracted color palette
3. **Click** a color in the palette or pick directly from the image
4. **Choose** a new color using the color picker, or upload a palette source image
5. **Apply** the swap - all pixels of that color change instantly
6. **Export** as GIF or PNG sequence when done

## 🎮 Use Cases

- **Character Variants** - Create different colored versions of game characters
- **Team Colors** - Make red/blue team variants for multiplayer games
- **Seasonal Themes** - Quickly recolor sprites for holiday events
- **Palette Experiments** - Try different color schemes before committing
- **Batch Processing** - Apply the same palette to multiple animations

## 🛠️ Tech Stack

- **HTML5** - Structure and Canvas API for image manipulation
- **Vanilla JavaScript** - All processing logic
- **CSS3** - Styling with modern features
- **[gifuct-js](https://github.com/matt-way/gifuct-js)** - GIF parsing and frame extraction
- **[JSZip](https://stuk.github.io/jszip/)** - ZIP file creation for PNG sequence export

No backend required - everything runs in the browser!

## 🚀 Running Locally

Since this is a static website, you can run it locally with any HTTP server:

```bash
# Clone the repository
git clone https://github.com/swompythesecond/pixelpaletteswap.git
cd pixelpaletteswap

# Using Python
python -m http.server 8000

# Or using Node.js (npx)
npx serve

# Or using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## 📁 Project Structure

```
pixelpaletteswap/
├── index.html      # Main application (tool + all JS logic)
├── styles.css      # Global styles and navigation
├── logo.png        # Site logo
├── favicon.ico     # Browser favicon
├── guides/         # Tutorial and guide pages
├── about.html      # About page
├── contact.html    # Contact page
├── privacy.html    # Privacy policy
└── patchnotes.html # Version history
```

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  Made with ❤️ for the pixel art community
</p>
