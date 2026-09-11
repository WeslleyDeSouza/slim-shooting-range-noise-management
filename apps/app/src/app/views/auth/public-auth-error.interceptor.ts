import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

/**
 * Auth endpoints that are reachable WITHOUT a session. A 401 from these means
 * «this link or code is wrong», not «your session expired».
 */
const PUBLIC_AUTH_ENDPOINTS = [
  '/auth/verify-email',
  '/auth/request-email-verification',
  '/auth/verify-pass-code',
  '/auth/request-pass-token',
  '/auth/pass-update',
  // 2FA step: a wrong code is a 401 — without the re-badge the refresh
  // interceptor bounced the person to the login instead of «code invalid».
  '/auth/verify-2fa-login',
];

/**
 * Keeps a rejected verification link from logging the visitor out.
 *
 * `AuthRefreshTokenInterceptor` (auth-ui) turns EVERY 401 into a token
 * refresh and, when that fails too, throws the app back to the login page —
 * it only exempts signin/signup/refresh. So opening an expired verification
 * link replaced the page's own «link invalid» state with a redirect, and the
 * resend button became unreachable.
 *
 * Re-badging the status keeps the refresh interceptor out of it while the
 * body — the API's actual message — reaches the page untouched. Register this
 * AFTER `provideAuth()` so it sits closer to the backend and sees the error
 * first.
 */
@Injectable()
export class PublicAuthErrorInterceptor implements HttpInterceptor {
  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    if (!PUBLIC_AUTH_ENDPOINTS.some((path) => request.url.includes(path))) {
      return next.handle(request);
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status !== 401) {
          return throwError(() => error);
        }
        return throwError(
          () =>
            new HttpErrorResponse({
              error: error.error,
              headers: error.headers,
              status: 422,
              statusText: error.statusText,
              url: error.url ?? undefined,
            }),
        );
      }),
    );
  }
}
