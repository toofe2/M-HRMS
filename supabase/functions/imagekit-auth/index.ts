import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ImageKit private key - in production, this should be stored as an environment variable
    const privateKey = 'private_y2KPQizJOXKcT1nMIiwPGIhI6Os=';
    
    // Generate authentication parameters
    const token = generateToken();
    const expire = Math.floor(Date.now() / 1000) + 2400; // 40 minutes from now
    const signature = generateSignature(token, expire, privateKey);

    const authParams = {
      token,
      expire,
      signature,
    };

    return new Response(JSON.stringify(authParams), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateSignature(token: string, expire: number, privateKey: string): Promise<string> {
  const stringToSign = token + expire;
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(privateKey);
  const messageData = encoder.encode(stringToSign);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureArray = new Uint8Array(signature);
  
  // Convert to hex string
  return Array.from(signatureArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}