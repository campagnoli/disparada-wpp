import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'disparada_admin';
const SESSION_DURATION_SECONDS = 12 * 60 * 60;

function getAdminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}

function getSessionSecret(): string | undefined {
  return process.env.ADMIN_SESSION_SECRET;
}

function createSignature(expiresAt: string, secret: string): string {
  return createHmac('sha256', secret).update(expiresAt).digest('base64url');
}

function safeEquals(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(getAdminPassword() && getSessionSecret());
}

export function validateAdminPassword(password: unknown): boolean {
  const expected = getAdminPassword();
  if (typeof password !== 'string' || !expected) return false;
  return safeEquals(password, expected);
}

export function hasAdminSession(request: NextRequest): boolean {
  const secret = getSessionSecret();
  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!secret || !cookie) return false;

  const separatorIndex = cookie.indexOf('.');
  if (separatorIndex < 1) return false;

  const expiresAt = cookie.slice(0, separatorIndex);
  const signature = cookie.slice(separatorIndex + 1);
  const expiry = Number(expiresAt);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(Date.now() / 1000)) return false;

  return safeEquals(signature, createSignature(expiresAt, secret));
}

export function setAdminSession(response: NextResponse): void {
  const secret = getSessionSecret();
  if (!secret) throw new Error('ADMIN_SESSION_SECRET não está configurada.');

  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS);
  response.cookies.set(COOKIE_NAME, `${expiresAt}.${createSignature(expiresAt, secret)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export function clearAdminSession(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}
