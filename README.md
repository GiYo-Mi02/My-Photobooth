# GioPix Photobooth

A modern photobooth built with the MERN stack (MongoDB, Express.js, React, Node.js) featuring real-time capture, admin-managed templates, and high-quality photostrip generation.

## Features

- Photo capture: Up to 10 shots with 5-second intervals and auto-start
- Selection & filters: Pick your best shots and apply filters (e.g., B&W)
- Template system: Admin uploads templates and defines slots visually or via JSON
- Template-native output: Generates at the template's native size (e.g., 2000x1600 landscape)
- Sharing & print: Download, QR share, and print (landscape 6" x 4")
- Kiosk mode: Optional UI lock-down for events

## Tech Stack

- Frontend: React 19 + Vite + TypeScript
- Backend: Node.js + Express.js
- Database: MongoDB
- Camera: WebRTC API
- Image Processing: Sharp (server) + Canvas/filters (client)
- File Upload: Multer

## Project Structure

```
giopix-photobooth/
├── frontend/          # React + Vite frontend
├── backend/           # Express.js backend
├── uploads/           # Temporary file storage
└── README.md
```

## Installation

1. Clone the repository
2. Install dependencies for all packages:

   - On Windows (cmd):
     - npm run install-all

3. Set up environment variables:

   - Copy `.env.example` to `.env` in the backend folder
   - Configure MongoDB connection string
   - Set other required environment variables

4. Start the development servers:
   - npm run dev
   - Or use the VS Code task: Dev: run frontend and backend

## Environment Variables

Create a `.env` file in the backend directory:

```
MONGODB_URI=mongodb://localhost:27017/photobooth
PORT=5000
JWT_SECRET=your_jwt_secret_here
UPLOAD_PATH=../uploads
```

## Usage

1. Photo Session: Start a session and take up to 10 photos
2. Photo Review: Review and select photos
3. Template Selection: Choose a template (admin-defined slots)
4. Filters: Apply optional filters
5. Photostrip Generation: Create and download/print the final photostrip
6. Admin Panel: Upload templates and define slots visually or via JSON

## Development

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- MongoDB: default port 27017

## Notes

- Printing: Uses landscape page hints for 6" x 4".
- Template mapping: Photos are placed into slots, then the template artwork is overlaid on top.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
