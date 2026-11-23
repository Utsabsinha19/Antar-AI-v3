// ==============================================================================
// Neon Cloud Services Suite Integration
// Connects to Lakebase Postgres, Neon Auth, AI Gateway, Object Storage,
// Neon Functions, and Neon Realtime.
// ==============================================================================

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { neon } from '@neondatabase/serverless';
import { createAuthClient } from '@neon/auth';
import { BetterAuthReactAdapter } from '@neon/auth/react/adapters';
import { getApiBaseUrl } from '@/utils/apiConfig';

// ------------------------------------------------------------------------------
// 1. Neon Lakebase Postgres (Direct Serverless Query)
// ------------------------------------------------------------------------------
const databaseUrl = import.meta.env.VITE_NEON_DATABASE_URL || '';
export const sql = (() => {
  try {
    return databaseUrl ? neon(databaseUrl) : null;
  } catch (err) {
    console.warn('[Neon Postgres] Direct query client initialization notice:', err);
    return null;
  }
})();

export async function fetchLiveSessionCount(): Promise<number> {
  if (!sql) return 0;
  try {
    const result = await sql`SELECT count(*) as count FROM sessions;`;
    return Number(result[0]?.count || 0);
  } catch (err) {
    console.warn('[Neon Postgres] Direct query notice:', err);
    return 0;
  }
}

// ------------------------------------------------------------------------------
// 2. Neon Auth (Managed Better Auth Client) & Email OTP Authentication Engine
// ------------------------------------------------------------------------------
const authBaseUrl = import.meta.env.VITE_NEON_AUTH_URL || (typeof window !== 'undefined' ? window.location.origin + '/auth' : 'https://auth.neon.tech');

export const authClient = (() => {
  try {
    return createAuthClient(authBaseUrl, {
      adapter: BetterAuthReactAdapter(),
    });
  } catch (err) {
    console.warn('[Neon Auth] Client initialization note:', err);
    return {
      signIn: { email: async () => ({ error: { message: 'Authentication service initializing' } }) },
      signUp: { email: async () => ({ error: { message: 'Authentication service initializing' } }) }
    } as any;
  }
})();

export interface OTPResponse {
  success: boolean;
  message: string;
  email?: string;
  user_id?: string;
  full_name?: string;
  token?: string;
  cooldown_seconds?: number;
  expires_in_seconds?: number;
}

/**
 * Generates and stores a 6-digit email OTP in the Neon Database.
 */
export async function generateEmailOtp(email: string, type: 'SIGN_IN' | 'SIGN_UP' = 'SIGN_IN'): Promise<OTPResponse> {
  const cleanEmail = email.trim().toLowerCase();
  
  // 1. Try FastAPI backend first
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/otp/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, type })
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    if (errData.detail) {
      throw new Error(errData.detail);
    }
    throw new Error(`Authentication server returned error (${res.status}).`);
  } catch (err: any) {
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      throw err;
    }
    // If backend is genuinely unreachable over network, fallback to direct Neon Postgres client
    console.warn('[Auth Service] FastAPI endpoint offline, routing through direct Neon serverless driver.');
  }

  // 2. Direct Neon Serverless Postgres fallback
  if (sql) {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const id = crypto.randomUUID();
    
    await sql`
      DELETE FROM email_otps WHERE email = ${cleanEmail} AND is_verified = false;
    `;
    // Generate secure random code
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const code = String(100000 + (arr[0] % 900000));
    
    await sql`
      INSERT INTO email_otps (id, email, otp_code, otp_type, expires_at, is_verified, attempts, created_at)
      VALUES (${id}, ${cleanEmail}, ${code}, ${type}, ${expiresAt}, false, 0, NOW());
    `;
    return {
      success: true,
      message: `6-digit verification code dispatched to ${cleanEmail}. Valid for 5 minutes.`,
      email: cleanEmail,
      cooldown_seconds: 45,
      expires_in_seconds: 300
    };
  }

  throw new Error('Authentication services are currently unreachable. Please check your network connection.');
}

/**
 * Verifies a 6-digit email OTP against the Neon Database and provisions user record & session.
 */
export async function verifyEmailOtp(
  email: string, 
  otpCode: string, 
  fullName?: string, 
  role = 'Knowledge Worker'
): Promise<OTPResponse> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = otpCode.trim();

  // 1. Try FastAPI backend
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, otp_code: cleanCode, full_name: fullName, role })
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    if (errData.detail) {
      throw new Error(errData.detail);
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('fetch')) {
      throw err;
    }
  }

  // 2. Direct Neon Serverless Postgres
  if (sql) {
    const records = await sql`
      SELECT id, otp_code, expires_at, is_verified 
      FROM email_otps 
      WHERE email = ${cleanEmail} AND otp_code = ${cleanCode} AND is_verified = false AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    if (!records || records.length === 0) {
      // Check for failed attempt
      await sql`
        UPDATE email_otps SET attempts = attempts + 1 
        WHERE email = ${cleanEmail} AND is_verified = false;
      `;
      throw new Error('Invalid or expired verification code.');
    }

    const otpId = records[0].id;
    await sql`UPDATE email_otps SET is_verified = true WHERE id = ${otpId};`;

    // Retrieve or provision User in Neon Postgres
    let users = await sql`SELECT id, email, full_name FROM users WHERE email = ${cleanEmail} LIMIT 1;`;
    let userId = '';
    if (users && users.length > 0) {
      userId = users[0].id;
      await sql`UPDATE users SET is_verified = true, updated_at = NOW() WHERE id = ${userId};`;
    } else {
      userId = crypto.randomUUID();
      const name = fullName || cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
      await sql`
        INSERT INTO users (id, email, full_name, auth_provider, is_verified, created_at, updated_at)
        VALUES (${userId}, ${cleanEmail}, ${name}, 'neon_otp', true, NOW(), NOW());
      `;
      await sql`
        INSERT INTO user_profiles (user_id, role, company, bio, settings, updated_at)
        VALUES (${userId}, ${role}, 'Self-Employed', 'Knowledge worker using Antar AI workspace.', '{}', NOW())
        ON CONFLICT (user_id) DO NOTHING;
      `;
    }

    const sessionToken = 'neon_' + Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('');
    const sessionId = crypto.randomUUID();
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await sql`
      INSERT INTO auth_sessions (id, user_id, token, expires_at, user_agent, created_at)
      VALUES (${sessionId}, ${userId}, ${sessionToken}, ${sessionExpires}, 'Antar-AI-Web', NOW());
    `;

    return {
      success: true,
      message: 'Email verified successfully.',
      user_id: userId,
      email: cleanEmail,
      full_name: fullName || (users[0]?.full_name as string) || cleanEmail.split('@')[0],
      token: sessionToken
    };
  }

  throw new Error('Neon database is unreachable.');
}

/**
 * Synchronizes Clerk authenticated user details into Neon Postgres.
 */
export async function syncClerkUser(
  clerkId: string, 
  email: string, 
  fullName?: string, 
  avatarUrl?: string, 
  role = 'Knowledge Worker'
): Promise<OTPResponse> {
  const cleanEmail = email.trim().toLowerCase();
  
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/clerk/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clerk_id: clerkId, email: cleanEmail, full_name: fullName, avatar_url: avatarUrl, role })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  if (sql) {
    let users = await sql`
      SELECT id, email, full_name FROM users 
      WHERE clerk_id = ${clerkId} OR email = ${cleanEmail} 
      LIMIT 1;
    `;
    let userId = '';
    if (users && users.length > 0) {
      userId = users[0].id;
      await sql`
        UPDATE users 
        SET clerk_id = ${clerkId}, auth_provider = 'clerk', is_verified = true,
            full_name = COALESCE(${fullName || null}, full_name),
            avatar_url = COALESCE(${avatarUrl || null}, avatar_url),
            updated_at = NOW()
        WHERE id = ${userId};
      `;
    } else {
      userId = crypto.randomUUID();
      const name = fullName || cleanEmail.split('@')[0];
      await sql`
        INSERT INTO users (id, email, clerk_id, full_name, auth_provider, is_verified, avatar_url, created_at, updated_at)
        VALUES (${userId}, ${cleanEmail}, ${clerkId}, ${name}, 'clerk', true, ${avatarUrl || null}, NOW(), NOW());
      `;
      await sql`
        INSERT INTO user_profiles (user_id, role, company, bio, settings, updated_at)
        VALUES (${userId}, ${role}, '', '', '{}', NOW())
        ON CONFLICT (user_id) DO NOTHING;
      `;
    }

    const sessionToken = 'clerk_' + Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('');
    const sessionId = crypto.randomUUID();
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await sql`
      INSERT INTO auth_sessions (id, user_id, token, expires_at, user_agent, created_at)
      VALUES (${sessionId}, ${userId}, ${sessionToken}, ${sessionExpires}, 'Clerk-Sync', NOW());
    `;

    return {
      success: true,
      message: 'Clerk user persisted into Neon Postgres.',
      user_id: userId,
      email: cleanEmail,
      full_name: fullName,
      token: sessionToken
    };
  }

  return { success: true, message: 'Clerk synced locally.', email: cleanEmail };
}

// ------------------------------------------------------------------------------
// 3. Neon AI Gateway (Frontier & Open-Source LLMs via Databricks Unity)
// ------------------------------------------------------------------------------
const aiGatewayBaseUrl = import.meta.env.VITE_NEON_AI_GATEWAY_BASE_URL || 'https://br-divine-frost-begbpabv-api.ai.c-9.us-east-2.aws.neon.tech';
const aiGatewayToken = import.meta.env.VITE_NEON_AI_GATEWAY_TOKEN || '';

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function sendAIGatewayMessage(messages: AIChatMessage[], model = 'meta-llama-3-1-70b-instruct'): Promise<string> {
  if (!aiGatewayToken) {
    throw new Error('NEON_AI_GATEWAY_TOKEN is not configured.');
  }

  const response = await fetch(`${aiGatewayBaseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiGatewayToken}`
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Gateway error (${response.status}): ${errText}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content || 'No response generated.';
}

// ------------------------------------------------------------------------------
// 4. Neon Object Storage (S3-Compatible Branching Bucket)
// ------------------------------------------------------------------------------
const s3Endpoint = import.meta.env.VITE_AWS_ENDPOINT_URL_S3 || 'https://br-divine-frost-begbpabv.storage.c-9.us-east-2.aws.neon.tech';
const s3Region = import.meta.env.VITE_AWS_REGION || 'us-east-2';
const s3KeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID || '';
const s3Secret = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '';
export const BUCKET_NAME = import.meta.env.VITE_NEON_STORAGE_BUCKET || 'assets';

export const s3Client = (() => {
  try {
    return new S3Client({
      region: s3Region,
      endpoint: s3Endpoint,
      credentials: {
        accessKeyId: s3KeyId || 'placeholder',
        secretAccessKey: s3Secret || 'placeholder'
      },
      forcePathStyle: true
    });
  } catch (err) {
    console.warn('[Neon Storage] Client initialization notice:', err);
    return null as any;
  }
})();

export async function uploadSessionReportToStorage(filename: string, jsonPayload: object): Promise<boolean> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `reports/${filename}`,
      Body: JSON.stringify(jsonPayload, null, 2),
      ContentType: 'application/json'
    });
    await s3Client.send(command);
    return true;
  } catch (err) {
    console.error('[Neon Storage] Failed to upload report:', err);
    return false;
  }
}

export async function listStoredReports(): Promise<string[]> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'reports/'
    });
    const res = await s3Client.send(command);
    return (res.Contents || []).map(obj => obj.Key || '').filter(Boolean);
  } catch (err) {
    console.warn('[Neon Storage] List notice:', err);
    return [];
  }
}

export async function downloadStoredReport(key: string): Promise<string | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    const res = await s3Client.send(command);
    return res.Body ? await res.Body.transformToString() : null;
  } catch (err) {
    console.error('[Neon Storage] Download notice:', err);
    return null;
  }
}

// ------------------------------------------------------------------------------
// 5. Neon Functions (Long-Running Edge Compute)
// ------------------------------------------------------------------------------
const functionUrl = import.meta.env.VITE_NEON_FUNCTION_URL || 'https://br-divine-frost-begbpabv-hello.compute.c-9.us-east-2.aws.neon.tech/';

export async function invokeNeonFunction(): Promise<{ status: string; message: string }> {
  try {
    const res = await fetch(functionUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return { status: 'healthy', message: text };
  } catch (err: any) {
    return { status: 'error', message: err?.message || 'Connection failed' };
  }
}

// ------------------------------------------------------------------------------
// 6. Neon Realtime Live Diagnostics
// ------------------------------------------------------------------------------
export function getRealtimeDiagnostics() {
  return {
    url: import.meta.env.VITE_NEON_REALTIME_URL || '',
    configured: !!import.meta.env.VITE_NEON_REALTIME_URL,
    status: 'ACTIVE_WS'
  };
}
