# Cloudflare Workers Setup Guide

This guide explains how to securely store your OpenAI API key using Cloudflare Workers instead of exposing it in client-side code.

## Why Use Cloudflare Workers?

- **Security**: Your API key is never exposed in browser code or Git repositories
- **Privacy**: Requests to OpenAI are proxied through Cloudflare
- **Simplicity**: Easy to set up and manage

## Setup Steps

### 1. Create a Cloudflare Account

- Go to [https://workers.cloudflare.com](https://workers.cloudflare.com)
- Sign up for a free Cloudflare account (if you don't have one)

### 2. Create a New Worker

1. Click on **"Create a Service"** or navigate to **Workers & Pages**
2. Click **"Create"** > **"Worker"**
3. Choose a name for your worker (e.g., `loreal-routine-api`)
4. Click **"Deploy"** (you'll replace the code in the next step)

### 3. Add the Worker Code

1. In the Cloudflare Worker editor, **select all** the existing code (Ctrl+A)
2. **Delete** it
3. Copy the entire code from the `cloudflare-worker.js` file in this project
4. **Paste** it into the Cloudflare Worker editor

### 4. Add Your OpenAI API Key

1. In the Cloudflare Worker dashboard, click **"Settings"**
2. Scroll to **"Environment Variables"**
3. Click **"Add Variable"**
4. Set the following:
   - **Variable name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (e.g., `sk-proj-...`)
5. Click **"Encrypt"**
6. Click **"Save"**

### 5. Deploy Your Worker

1. Click **"Deploy"** in the worker editor
2. Your worker is now live! Copy your worker URL (it looks like: `https://your-worker-name.your-account.workers.dev`)

### 6. Update Your Project

1. Open `script.js` in your project
2. Find this line (near the top):
   ```javascript
   const CLOUDFLARE_WORKER_URL = "https://YOUR_CLOUDFLARE_WORKER_URL";
   ```
3. Replace `YOUR_CLOUDFLARE_WORKER_URL` with your actual worker URL (from step 5)

### 7. Remove secrets.js (Optional)

You can safely delete the `secrets.js` file from your project since your API key is now stored securely in Cloudflare.

## Testing

1. Open your project in a browser
2. Select some products
3. Click **"Generate Routine"**
4. If everything works, your Cloudflare setup is complete!

## Troubleshooting

### "Worker error" Messages

- Check that your worker URL in `script.js` is correct
- Verify your `OPENAI_API_KEY` environment variable is set correctly in Cloudflare

### CORS Errors

- The worker already has CORS headers configured
- Make sure you're deploying the exact code from `cloudflare-worker.js`

### API Key Errors

- Double-check that your OpenAI API key is correct and has a valid balance
- Make sure it's pasted exactly as provided (including the `sk-` prefix)

## Security Notes

- Never commit your API key to Git
- The Cloudflare worker keeps your API key private on the server
- All requests to OpenAI are now proxied through Cloudflare
