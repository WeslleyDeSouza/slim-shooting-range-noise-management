// The app boots through a dynamic import so locale data, store registration
// and any future federation setup happen before the Angular bootstrap.
import('./bootstrap').catch((err: unknown) => console.error(err));
