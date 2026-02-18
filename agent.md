Act as a Senior Frontend Developer. I want to build a "Book Reader" website hosted on GitHub Pages using React (Vite) + Tailwind CSS.

Core Requirements:
1. Source: Content is stored in .md (markdown) files.
2. Structure:
   - /public/eng-episodes/*.md
   - /public/burmese-episodes/*.md
3. UI/UX:
   - Full Frame: The app should take up the entire screen (no default browser scrollbars).
   - Page Flip Effect: Use react-pageflip (or `simple-react-page-flip`) to simulate a real book turning effect when moving to the next chapter/page.
   - Clean Design: Minimalist interface. A toggle or menu to switch between "English" and "Burmese" collections.
4. Tech Stack: React, Vite, Tailwind CSS, react-markdown, react-router-dom.

Specific Implementation Details:
- Since it is for GitHub Pages, use HashRouter for routing.
- Create a utility function to fetch the markdown files from the public folder.
- The "Book" component should render the markdown content on separate "Pages".
- Handle responsiveness (1 page view on mobile, 2 page spread on desktop if possible).

Output Needed:
1. Project file structure.
2. package.json dependencies.
3. App.jsx (Routing and Layout).
4. BookReader.jsx (The component that implements the Page Flip logic and fetches markdown).
5. tailwind.config.js snippet for full-frame setup.

Please provide the complete, working code structure.
