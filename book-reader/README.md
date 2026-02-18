# Renegade Immortal - Book Reader

A beautiful book reader web application built with React, Vite, and Tailwind CSS. Features a realistic page-flip effect using react-pageflip.

## Features

- 📖 **Page Flip Effect**: Realistic book page turning animation
- 🌐 **Dual Language Support**: Toggle between English and Burmese
- 📱 **Responsive Design**: Single page on mobile, two-page spread on desktop
- 🔍 **Episode Navigation**: Jump to any episode with the episode selector
- 🎨 **Elegant Design**: Warm, book-like color scheme

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- react-pageflip
- react-markdown
- react-router-dom (HashRouter for GitHub Pages)

## Project Structure

```
book-reader/
├── public/
│   ├── eng-episodes/       # English markdown files
│   │   ├── 0001-0100/
│   │   │   └── 0001.md
│   │   └── ...
│   ├── burmese-episodes/   # Burmese markdown files
│   │   └── ...
│   └── episode-index.json  # Episode metadata
├── src/
│   ├── components/
│   │   └── BookReader.jsx  # Main book reader component
│   ├── utils/
│   │   ├── markdownUtils.js # Markdown fetching utilities
│   │   └── episodeIndex.js  # Episode index management
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── package.json
├── vite.config.js
├── tailwind.config.js
└── index.html
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Deploy to GitHub Pages:
```bash
npm run deploy
```

## Configuration

### Adding Episodes

Place markdown files in the appropriate folder structure:
- English: `public/eng-episodes/{range}/{episode}.md`
- Burmese: `public/burmese-episodes/{range}/{episode}.md`

Folder ranges:
- `0001-0100` for episodes 1-100
- `0101-0200` for episodes 101-200
- etc.

### Episode Format

Episodes should be markdown files with a title heading:

```markdown
# Chapter X - Title

Content here...
```

## GitHub Pages Deployment

This project is configured for GitHub Pages deployment using HashRouter. Update the `homepage` field in `package.json` with your repository URL before deploying.

### Automatic Deployment via GitHub Actions

This project includes two GitHub Actions workflows:

#### 1. CI Workflow (`.github/workflows/ci.yml`)
- **Triggers**: On push/PR to `main`/`master` branches
- **Jobs**:
  - Install dependencies with `npm ci`
  - Run ESLint checks
  - Build the project
  - Upload build artifacts

#### 2. Deploy Workflow (`.github/workflows/deploy.yml`)
- **Triggers**: On push to `main`/`master` branches
- **Jobs**:
  - Build the project using Node.js 20
  - Upload to GitHub Pages using `actions/upload-pages-artifact@v3`
  - Deploy using `actions/deploy-pages@v4`

### Setup Instructions

1. **Enable GitHub Pages**:
   - Go to your repository Settings → Pages
   - Set "Source" to "GitHub Actions"

2. **Update Repository Settings**:
   - Go to Settings → Actions → General
   - Under "Workflow permissions", ensure "Read and write permissions" is granted

3. **Configure Repository Name** (if needed):
   - Update `homepage` in `package.json` with your actual repository URL
   - The `vite.config.js` uses relative paths (`./`) by default for hash-based routing compatibility

### Manual Deployment (Alternative)

If you prefer manual deployment using `gh-pages`:

```bash
npm run deploy
```

**Note**: For GitHub Pages with a custom domain or root-level deployment, update `vite.config.js`:

```javascript
base: '/your-repo-name/',  // For project site
// OR
base: '/',                 // For custom domain
```

## License

MIT
