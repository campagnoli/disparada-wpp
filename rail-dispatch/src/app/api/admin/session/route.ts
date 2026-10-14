import { NextRequest, NextResponse } from 'next/server';
import {
  clearAdminSession,
  hasAdminSession,
  isAdminPasswordConfigured,
  setAdminSession,
  validateAdminPassword,
} from '@/lib/admin';

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { authenticated: isAdminPasswordConfigured() && hasAdminSession(request) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: NextRequest) {
  if (!isAdminPasswordConfigured()) {
    return NextResponse.json(
      { error: 'Configure ADMIN_PASSWORD e ADMIN_SESSION_SECRET no ambiente do servidor.' },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || !('password' in body) || !validateAdminPassword(body.password)) {
    return NextResponse.json({ error: 'Senha de administrador incorreta.' }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  setAdminSession(response);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  clearAdminSession(response);
  return response;
}
