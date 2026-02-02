import type { VercelRequest, VercelResponse } from '@vercel/node';

interface TokenRequest {
  code: string;
  redirect_uri: string;
}

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, redirect_uri } = req.body as TokenRequest;

    // Validate required fields
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    if (!redirect_uri) {
      return res.status(400).json({ error: 'Missing redirect_uri' });
    }

    // Validate redirect_uri matches expected scheme
    // This prevents authorization code injection attacks
    if (!redirect_uri.startsWith('flowforge://')) {
      console.warn('Invalid redirect_uri attempted:', redirect_uri);
      return res.status(400).json({ error: 'Invalid redirect_uri' });
    }

    // Validate environment variables
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Missing GitHub OAuth credentials in environment');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Exchange code for token with GitHub
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri,
        }),
      }
    );

    if (!tokenResponse.ok) {
      console.error('GitHub token exchange failed:', tokenResponse.status);
      return res.status(502).json({ error: 'GitHub API error' });
    }

    const data: GitHubTokenResponse = await tokenResponse.json();

    // Check for GitHub error response
    if (data.error) {
      console.warn('GitHub OAuth error:', data.error, data.error_description);
      return res.status(400).json({
        error: data.error_description || data.error,
      });
    }

    // Validate we got a token
    if (!data.access_token) {
      console.error('No access_token in GitHub response');
      return res.status(502).json({ error: 'Invalid response from GitHub' });
    }

    // Return the token (never log tokens!)
    return res.status(200).json({
      access_token: data.access_token,
      token_type: data.token_type || 'bearer',
      scope: data.scope || '',
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
