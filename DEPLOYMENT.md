# Deployment Guide

This project is easiest to deploy as two services:

- Frontend: Vercel static Vite app from `Frontend`
- Backend: Render Node web service from `Backend`
- Database: MongoDB Atlas

## 1. Create MongoDB Atlas Database

1. Create a free MongoDB Atlas cluster.
2. Create a database user and password.
3. Allow network access from `0.0.0.0/0` for hosted deployments.
4. Copy the connection string and use it as `MONGO_URI`.

Example:

```env
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/interview-ai
```

## 2. Deploy Backend On Render

Use the root `render.yaml` blueprint or create a Web Service manually.

Manual settings:

```text
Root Directory: Backend
Build Command: npm install
Start Command: npm start
Health Check Path: /api/health
```

Backend environment variables:

```env
NODE_ENV=production
CLIENT_URL=https://your-frontend-domain.vercel.app
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/interview-ai
JWT_SECRET=generate-a-long-random-secret
GOOGLE_GENAI_API_KEY=your-google-genai-key
GEMINI_MODEL=gemini-2.5-flash
```

After deploy, verify:

```text
https://your-render-service.onrender.com/api/health
```

It should return:

```json
{ "status": "ok" }
```

## 3. Deploy Frontend On Vercel

Create a new Vercel project using the `Frontend` directory.

Settings:

```text
Framework Preset: Vite
Root Directory: Frontend
Build Command: npm run build
Output Directory: dist
```

Frontend environment variables:

```env
VITE_API_URL=https://your-render-service.onrender.com
```

The included `Frontend/vercel.json` makes direct page refreshes work with React Router.

## 4. Final Backend Update

After Vercel gives you the frontend URL, update the Render backend `CLIENT_URL` to that exact URL.

If you use multiple frontend URLs, separate them with commas:

```env
CLIENT_URL=https://your-app.vercel.app,http://localhost:5173
```

Redeploy the backend after changing env vars.

## 5. Smoke Test

1. Open the Vercel frontend URL.
2. Register a new account.
3. Login.
4. Generate an interview report.
5. Open Project Stories, Answer Practice, and Mock Interview.
6. Download the resume PDF.

If login succeeds but authenticated requests fail, check that:

- `NODE_ENV=production` is set on backend.
- `CLIENT_URL` exactly matches the Vercel URL, including `https://`.
- `VITE_API_URL` exactly matches the Render backend URL.
