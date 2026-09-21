import { fileStaticPath } from './core-static-file.module';
import { TENANT_ENTITY } from '@app-galaxy/core-api';
import { DataSource, QueryRunner } from 'typeorm';
import type { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Types
interface DomainConfig {
  domain: string;
  [key: string]: any;
}

interface CacheEntry {
  html: string;
  timestamp: number;
}

// Constants
const CACHE_EXPIRY_MS = 20 * 60 * 1000; // 20 minutes
const HTML_CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const INJECTION_PLACEHOLDER = '<script name="[INCUBATOR]"></script>';

/**
 * Extracts the root domain from a full domain string
 * @param fullDomain - The full domain (e.g., "subdomain.example.com:3000")
 * @returns The root domain (e.g., "example.com")
 */
function extractRootDomain(fullDomain: string): string {
  if (!fullDomain) return '';

  // Remove port if present (e.g., test.com:3000 -> test.com)
  const domainWithoutPort = fullDomain.split(':')[0];

  // Extract the last two parts (domain.tld)
  const parts = domainWithoutPort.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }

  return domainWithoutPort;
}

/**
 * Extracts the full domain with subdomain from a domain string
 * @param fullDomain - The full domain (e.g., "dashboard.nnn.ch:3000")
 * @returns The domain with subdomain (e.g., "dashboard.nnn.ch")
 */
function extractDomainWithSubdomain(fullDomain: string): string {
  if (!fullDomain) return '';

  // Remove port if present (e.g., dashboard.nnn.ch:3000 -> dashboard.nnn.ch)
  const domainWithoutPort = fullDomain.split(':')[0];

  return domainWithoutPort;
}

/**
 * Safely parses JSON string, returns null if parsing fails
 * @param str - String to parse
 * @returns Parsed object or original value if not a string, null if parsing fails
 */
function tryParseJson(str: any): any {
  if (typeof str !== 'string') return str;
  try {
    let json = JSON.parse(str);
    return typeof json === 'string' ? JSON.parse(json) : json;
  } catch (error) {
    return null;
  }
}

/**
 * Checks if the request path should be handled by static file middleware
 * @param req - Express request object
 * @returns True if path should be handled statically
 */
function isStaticIndexPath(req: Request): boolean {
  const url = req.url;

  // must be compatible with index.html and / path
  const isStaticIndexPath =
    !url?.startsWith('/api') &&
    !url?.startsWith('/docs') &&
    !url?.startsWith('/assets') &&
    (!url?.includes('.') || url.includes('index.html')); // If path will ever have a dot, this needs to be adapted

  return isStaticIndexPath;
}

/**
 * Service class for handling domain configuration queries
 */
class DomainConfigService {
  private readonly tableName: string;
  private readonly keyName = 'domainName';
  private readonly keySubName = 'domainTopLevel';

  constructor() {
    this.tableName = TENANT_ENTITY.entityNameResolver('tenant') + '_app_config';
  }

  /**
   * Retrieves domain configuration from database
   * @param dataSource - TypeORM DataSource
   * @param domain - Domain to query
   * @returns Domain configuration object
   */
  async getDomainConfig(
    dataSource: DataSource,
    domain: string
  ): Promise<DomainConfig> {
    const queryRunner: QueryRunner = dataSource.createQueryRunner();

    try {
      const query = `SELECT config FROM ${this.tableName} WHERE ${this.keyName} = ? AND ${this.keySubName} = ?`;
      const params = [domain, domain?.split('.')?.pop()];

      const resultQuery = await queryRunner
        .query(query, params)
        .catch(() => []);

      const result = tryParseJson(resultQuery[0]?.config) || {};

      if (+process.env['API_LOG_STATIC_FILE_CONFIG'] > 0) {
        console.log(query, params, resultQuery, result);
      }

      return result;
    } finally {
      await queryRunner.release();
    }
  }
}

/**
 * Cache manager for HTML content and domain configurations
 */
class CacheManager {
  private htmlCache: string | null = null;
  private htmlCacheTimestamp: number = 0;
  private domainCache = new Map<string, CacheEntry>();

  /**
   * Gets cached HTML content or reads from file
   * @param filePath - Path to HTML file
   * @returns HTML content
   */
  getHtmlContent(filePath: string): string {
    const now = Date.now();

    if (
      !this.htmlCache ||
      now - this.htmlCacheTimestamp > HTML_CACHE_EXPIRY_MS
    ) {
      this.htmlCache = fs.readFileSync(filePath, 'utf8');
      this.htmlCacheTimestamp = now;
    }

    return this.htmlCache;
  }

  /**
   * Gets cached domain HTML or returns null if not found/expired
   * @param domain - Domain key
   * @returns Cached HTML or null
   */
  getCachedDomainHtml(domain: string): string | null {
    const entry = this.domainCache.get(domain);

    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > CACHE_EXPIRY_MS) {
      this.domainCache.delete(domain);
      return null;
    }

    return entry.html;
  }

  /**
   * Caches domain-specific HTML
   * @param domain - Domain key
   * @param html - HTML content to cache
   */
  setCachedDomainHtml(domain: string, html: string): void {
    this.domainCache.set(domain, {
      html,
      timestamp: Date.now(),
    });
  }

  /**
   * Clears expired cache entries
   */
  clearExpiredEntries(): void {
    const now = Date.now();

    for (const [domain, entry] of this.domainCache.entries()) {
      if (now - entry.timestamp > CACHE_EXPIRY_MS) {
        this.domainCache.delete(domain);
      }
    }
  }
}

/**
 * HTML injection utility
 */
class HtmlInjector {
  /**
   * Injects domain configuration into HTML
   * @param html - Original HTML content
   * @param domain - Domain name
   * @param config - Domain configuration
   * @returns Modified HTML with injected script
   */
  static injectDomainInfo(
    html: string,
    domain: string,
    config: DomainConfig
  ): string {
    const appConfig = Object.assign(config, {
      domain,
      subDomainSegment: domain?.split('.')?.pop(),
    });
    const script = `<script>window.APP_CONFIG = ${JSON.stringify(
      appConfig
    )};</script>`;

    return html.replace(INJECTION_PLACEHOLDER, script);
  }
}

/**
 * Creates and returns the static file middleware
 * @param dataSource - TypeORM DataSource instance
 * @returns Express middleware function
 */
export function staticFileMiddleware(dataSource: DataSource) {
  const domainConfigService = new DomainConfigService();
  const cacheManager = new CacheManager();

  // Periodic cache cleanup
  setInterval(() => {
    cacheManager.clearExpiredEntries();
  }, CACHE_EXPIRY_MS);

  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!isStaticIndexPath(req)) {
      return next();
    }

    const url = req.url;
    const domain = extractDomainWithSubdomain(req.get('host') || '');
    const filePath = path.join(fileStaticPath, 'index.html');
    const canLoadFromCache = !url.includes('ngsw-cache-bust');

    try {
      // Check cache first
      const cachedHtml = canLoadFromCache
        ? cacheManager.getCachedDomainHtml(domain)
        : null;

      if (cachedHtml) {
        res.setHeader('Content-Type', 'text/html');
        res.send(cachedHtml);
        return;
      }

      // Get domain configuration and HTML content
      const [domainConfig, htmlContent] = await Promise.all([
        domainConfigService.getDomainConfig(dataSource, domain),
        Promise.resolve(cacheManager.getHtmlContent(filePath)),
      ]);

      // Inject domain info and cache result
      const modifiedHtml = HtmlInjector.injectDomainInfo(
        htmlContent,
        domain,
        domainConfig
      );

      cacheManager.setCachedDomainHtml(domain, modifiedHtml);

      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, private'
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Type', 'text/html');

      res.send(modifiedHtml);
      return;
    } catch (error) {
      console.warn('Static file middleware error:', error);
      next();
    }
  };
}
