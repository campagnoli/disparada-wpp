import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'cco_session_token';
const SESSION_DURATION_SECONDS = 60 * 60 * 12;
const INVALID_CREDENTIALS = { error: 'Credencial inválida' };

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  const password = 'password' in body ? body.password : undefined;
  const expectedPassword = process.env.APP_ACCESS_PASSWORD;

  if (typeof password !== 'string' || !expectedPassword || password !== expectedPassword) {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, 'authenticated_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });

  return response;
}
