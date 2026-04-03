# GitHub OAuth Setup Guide

To enable the "Connected Apps" GitHub integration where users can log in and directly import their public and private repositories, you need to create a GitHub OAuth Application.

## Step 1: Create the OAuth Application
1. Go to your GitHub Settings: **[Developer Settings -> OAuth Apps](https://github.com/settings/developers)**.
2. Click **New OAuth App**.
3. Fill in the details:
   - **Application name:** devportal2 (or anything you prefer)
   - **Homepage URL:** The base URL of your Hugging Face Space (e.g., `https://ajitdoval-devportal2.hf.space`)
   - **Authorization callback URL:** Must be exactly your Space URL followed by `/api/github/callback`. (e.g., `https://ajitdoval-devportal2.hf.space/api/github/callback`)
4. Click **Register application**.

## Step 2: Get your Credentials
1. On the app page you just created, you will see the **Client ID**. Copy this.
2. Click **Generate a new client secret**. Copy the generated secret immediately (it will be hidden later).

## Step 3: Configure Environment Variables
Go to your Hugging Face Space settings, and add the following **Variables and secrets**:

- `GITHUB_CLIENT_ID` = (paste the Client ID from Step 2)
- `GITHUB_CLIENT_SECRET` = (paste the Client Secret from Step 2)

Once these are set, restart your Space. The "Connected Apps" integration will now securely link user accounts and fetch repositories!
