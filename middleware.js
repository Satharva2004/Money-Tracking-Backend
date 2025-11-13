import { NextResponse } from 'next/server';
//allow cors for money-tracking-frontend
const DEFAULT_ALLOWED_ORIGINS = [
  'https://money-tracking-backend.vercel.app',
  'http://localhost:8080',
];

function getAllowedOrigins() {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (!envOrigins) return DEFAULT_ALLOWED_ORIGINS;
  return envOrigins.split(',').map(origin => origin.trim()).filter(Boolean);
}

function applyCorsHeaders(response, origin) {
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Origin, Content-Type, Accept, Authorization, X-Requested-With'
  );
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
}

export function middleware(request) {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();
  const isAllowedOrigin = !origin || allowedOrigins.includes(origin);

  if (request.method === 'OPTIONS') {
    const preflightResponse = new NextResponse(null, { status: 204 });
    if (isAllowedOrigin && origin) {
      applyCorsHeaders(preflightResponse, origin);
    } else {
      applyCorsHeaders(preflightResponse, allowedOrigins[0]);
    }
    return preflightResponse;
  }

  const response = NextResponse.next();
  if (isAllowedOrigin && origin) {
    applyCorsHeaders(response, origin);
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
