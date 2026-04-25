# own's hub - Premium Adult Video Streaming
# sigh

## Folder Structure (2026 Reorganization)

- html/: HTML files
- css/: CSS files
- js/: JavaScript files
- json/: JSON files
- img/, jpg/, png/: Images
- md/: Markdown files
- db/: Database files
- bat/: Batch scripts
- scripts/: Miscellaneous scripts
- backend/, controllers/, models/, routes/, server/: Backend/server code
- public/: Public assets
- vendor/, fonts/, themes/, utils/: Supporting assets
- pug/: Pug templates
- readme/: Documentation

Update all file references in your code to match the new structure.
```bash
cd path/to/website
python -m http.server 8000
```
Then open: `http://localhost:8000`

#### Using Node.js:
```bash
npm install -g http-server
cd path/to/website
http-server
```
Then open: `http://localhost:8080`

#### Using PHP:
```bash
cd path/to/website
php -S localhost:8000
```
Then open: `http://localhost:8000`

## Backend Setup

To enable all features, you must run the backend server:

1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the backend server:
   ```bash
   npm start
   ```
   The backend will run at http://localhost:3001

If you want others to access your backend, deploy it to a public service (like Render, Heroku, or Vercel) and update the frontend code to use the deployed backend URL instead of http://localhost:3001.

## Technologies Used
- HTML5
- CSS3 (Custom Properties, Flexbox, Grid)
- JavaScript (ES6+)
- Vimeo API for video embedding

# gitgitownshub
git git hurray!
