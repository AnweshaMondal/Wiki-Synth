# Wikipedia Summarizer Chrome Extension

![Wikipedia Summarizer](icons/icon128.png)

A powerful Chrome browser extension that provides AI-powered summaries of Wikipedia articles with customizable styles and lengths. Get instant, intelligent summaries of any Wikipedia page directly in your browser.

## ✨ Features

### 🎯 **Core Functionality**
- **Smart Article Detection**: Automatically detects Wikipedia articles and provides summarization options
- **Multiple Summary Styles**: Choose from Wikipedia, Academic, Casual, or Technical writing styles
- **Flexible Length Options**: Short, Medium, Long, or Detailed summaries to match your needs
- **Real-time Processing**: Fast, AI-powered summarization using your backend API

### 🖥️ **User Interface**
- **Beautiful Popup Interface**: Clean, modern design with intuitive controls
- **Floating Widget**: In-page summarization widget that appears on Wikipedia articles
- **Context Menus**: Right-click to summarize current page or selected text
- **Responsive Design**: Works perfectly on all screen sizes

### 🔧 **Advanced Features**
- **Auto-Detection**: Automatically detect and fill in the current Wikipedia page
- **Quick Summary**: One-click instant summaries for fast reading
- **Copy & Save**: Easy sharing and saving of generated summaries
- **Usage Tracking**: Monitor your API usage and subscription limits
- **History**: Keep track of all your summarized articles

### 🎨 **Enhanced Reading Experience**
- **Article Enhancements**: Adds summarization buttons directly to Wikipedia pages
- **Section Summaries**: Summarize individual sections of long articles
- **Key Sentence Highlighting**: Automatically highlights important sentences
- **Dark Mode Support**: Seamless experience in both light and dark themes

## 🚀 Installation

### Option 1: Load as Unpacked Extension (Development)

1. **Download or Clone** this repository
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in the top right)
4. **Click "Load unpacked"** and select the extension folder
5. **Configure your API** by clicking the extension icon and going to Settings

### Option 2: Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store once published.

## ⚙️ Configuration

Before using the extension, you need to configure your API credentials:

1. **Click the extension icon** in your browser toolbar
2. **Open Settings** from the popup
3. **Enter your API credentials**:
   - API Base URL: `https://your-api-domain.com/api`
   - API Key: Your unique API key
   - JWT Token: Your authentication token

### API Integration

This extension integrates with your Wikipedia Summarizer backend API. Make sure your API supports these endpoints:

```
POST /api/summary          # Generate summaries
GET  /api/auth/me          # Get user info and usage stats
POST /api/auth/login       # Authentication
GET  /api/summary/history  # Summary history
```

## 🎮 Usage

### Basic Summarization

1. **Navigate to any Wikipedia article**
2. **Click the extension icon** or use the floating widget
3. **Choose your preferred style and length**
4. **Click "Summarize Article"** and wait for results
5. **Copy, save, or share** your summary

### Quick Actions

- **Auto-detect**: Click the magic wand icon to auto-fill the current Wikipedia page
- **Quick Summary**: Get an instant casual, short summary with one click
- **Context Menu**: Right-click on any Wikipedia page to access summarization options

### Advanced Features

- **Section Summaries**: Use the 📄 buttons next to section headers
- **Key Sentences**: Hover over highlighted text for important information
- **History**: Access your summary history from the footer links
- **Settings**: Customize default options and API configuration

## 🔒 Privacy & Security

- **No Data Collection**: The extension only processes data you explicitly choose to summarize
- **Secure API Communication**: All API calls use HTTPS and authentication tokens
- **Local Storage**: Settings and history are stored locally in your browser
- **Open Source**: Full source code is available for review

## 🛠️ Development

### Project Structure

```
WikiPedro/
├── manifest.json          # Extension manifest
├── popup.html             # Main popup interface
├── popup.css              # Popup styles
├── popup.js               # Popup functionality
├── background.js          # Service worker
├── content.js             # Content script for Wikipedia pages
├── content.css            # Content script styles
├── icons/                 # Extension icons
└── README.md              # This file
```

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd WikiPedro
   ```

2. **Load in Chrome**
   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked"
   - Select the project folder

3. **Make changes** and reload the extension to test

### API Configuration

Update the API base URL in the following files:
- `popup.js` - Line 6: `this.apiBaseUrl`
- `background.js` - Line 187: API request URLs

## 🎨 Customization

### Themes
The extension supports both light and dark themes, automatically adapting to your system preferences.

### Styles
Modify `popup.css` and `content.css` to customize the appearance:
- Colors and gradients
- Button styles and animations
- Layout and spacing
- Responsive breakpoints

### Functionality
Extend the extension by modifying:
- `popup.js` - Main popup logic
- `content.js` - Wikipedia page enhancements
- `background.js` - Background processes and context menus

## 📊 API Usage & Limits

The extension respects your API subscription limits:
- **Free Tier**: 100 summaries per month
- **Basic Tier**: 1,000 summaries per month
- **Premium Tier**: 10,000 summaries per month
- **Enterprise**: Unlimited summaries

Usage statistics are displayed in the popup footer and updated in real-time.

## 🆘 Troubleshooting

### Common Issues

**Extension not working on Wikipedia pages**
- Ensure you're on a Wikipedia article page (not the main page)
- Check if content scripts are enabled in `chrome://extensions/`

**API connection errors**
- Verify your API credentials in Settings
- Check your internet connection
- Ensure your API backend is running

**Summaries not generating**
- Check your usage limits
- Verify the article title is correct
- Try a different summary style or length

### Debug Mode

Enable debug mode by:
1. Opening Chrome DevTools (F12)
2. Going to the Console tab
3. Looking for extension-related messages

## 🤝 Contributing

We welcome contributions! Please:

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

### Contribution Guidelines

- Follow the existing code style
- Add comments for complex functionality
- Test on multiple Wikipedia articles
- Update documentation as needed

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **API Documentation**: [Your API Docs URL]
- **Support**: [Your Support URL]
- **Website**: [Your Website URL]
- **Chrome Web Store**: [Coming Soon]

## 🙏 Acknowledgments

- **Wikipedia**: For providing the amazing knowledge base
- **Chrome Extensions API**: For the powerful extension platform
- **Your Backend API**: For the AI-powered summarization capabilities

---

**Made with ❤️ for Wikipedia enthusiasts and knowledge seekers**

*Get intelligent summaries of any Wikipedia article in seconds. Perfect for students, researchers, and curious minds.*
