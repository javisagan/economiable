# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start server**: `npm start` - Starts the Express server (auto-assigns port for deployment)
- **Install dependencies**: `npm install` - Install all required packages

## Environment Setup

This project uses a **local JSON storage system** with enterprise-grade security. Required environment variables:

- `ADMIN_PASSWORD` - Password for admin panel access
- `JWT_SECRET` - Secret key for JWT token signing (256-bit minimum)

Optional environment variables:
- `PORT` - Port number (auto-assigned by hosting platform if not specified)
- `JWT_EXPIRES_IN` - JWT token expiration time (default: 2h)
- `REFRESH_TOKEN_EXPIRES_IN` - Refresh token expiration (default: 7d)
- `LOG_LEVEL` - Logging level: error, warn, info, debug (default: info)
- `ALLOWED_ORIGINS` - CORS allowed origins (comma-separated)
- `RATE_LIMIT_MAX` - Global rate limit per window (default: 100)
- `RATE_LIMIT_LOGIN_MAX` - Login rate limit per window (default: 5)
- `NODE_ENV` - Environment mode (development/production)

## Architecture Overview

This is a **production-ready Node.js blog application** with enterprise security features, using JSON files as local database storage.

### Backend (server.js) - Version 5.0
- **Express.js server** with EJS templating and Helmet security headers
- **JSON storage system** (`lib/jsonStorage.js`) for content management
- **RESTful API** at `/api/*` endpoints with full CRUD operations
- **JWT authentication** with access/refresh tokens and automatic expiration
- **Rate limiting** with login-specific protection (5 attempts/15min)
- **Input validation** with Joi schemas and HTML sanitization
- **Structured logging** with Winston (JSON format, rotating files)
- **Automatic slug generation** from post titles for SEO-friendly URLs

### Frontend Structure
- **Public blog** - Server-side rendered pages with justified text formatting
- **Admin panel** - Secure SPA at `/admin` with JWT authentication
- **Admin utilities** - Protected sitemap/robots.txt generators at `/admin/utilidades`
- **Edit buttons** - Context-sensitive editing (admin-only) on post pages
- **Static assets** in `/public` (CSS, images) with optimized caching

### Security Features
- **XSS Protection**: Complete DOM sanitization, no innerHTML usage
- **CSRF Protection**: JWT tokens with CORS restrictions
- **Rate Limiting**: Global (100/15min) + Login-specific (5/15min)
- **Security Headers**: CSP, X-Frame-Options, HSTS (production)
- **Input Validation**: Joi schemas with strict limits and sanitization
- **Logging**: Security events, failed logins, rate limit violations

### Key Components
- **JWT Authentication**: Secure token-based auth with refresh mechanism
- **Post Management**: Full CRUD with field validation (title: 200 chars, author: 200 chars)
- **Search System**: Real-time search with term highlighting in admin panel
- **File Generation**: Automated sitemap.xml and robots.txt creation
- **Responsive UI**: Mobile-optimized admin interface with subtle gray styling

### Data Structure (JSON Files)
- **`data/posts.json`** - Blog posts with auto-generated slugs
- **`data/pages.json`** - Static page content
- **`data/config.json`** - Site configuration
- **`logs/`** - Structured logs (app.log, error.log, security.log)

Posts schema:
- `title` (string, max: 200) - Required
- `subtitle` (string, max: 300) - Optional  
- `author` (string, max: 200) - Required
- `date` (ISO date) - Required
- `content` (string, max: 100K) - Required, justified display
- `excerpt` (string, max: 1K) - Required
- `imageUrl` (URL, max: 2048) - Optional
- `tags` (string, max: 500) - Comma-separated
- `metaTitle` (string, max: 60) - SEO
- `metaDescription` (string, max: 160) - SEO
- `slug` (string) - Auto-generated, URL-safe

### API Endpoints (JWT Protected)
- `POST /api/login` - Admin login (rate-limited)
- `POST /api/refresh-token` - Token refresh
- `POST /api/logout` - Secure logout
- `GET /api/posts` - List posts (admin)
- `GET /api/posts/:id` - Single post (admin)
- `POST /api/posts` - Create post (validated)
- `PUT /api/posts/:id` - Update post (validated)
- `DELETE /api/posts/:id` - Delete post
- `PUT /sitemap.xml` - Generate sitemap (admin)
- `PUT /robots.txt` - Generate robots.txt (admin)

### Frontend Routes
- `/` - Homepage with post listing
- `/post/:slug` - Individual posts (with admin edit button if logged in)
- `/suscribete` - Subscription page (form removed)
- `/sobre-economiable` - About page
- `/admin` - Secure admin panel (JWT required)
- `/admin/utilidades` - Protected utilities (sitemap/robots generation)

## Production Deployment

The application is **ready for production deployment** with:
- **Auto-port detection**: Works with any hosting platform (Heroku, Railway, Vercel, etc.)
- **Environment-based config**: Separate development/production settings
- **Security hardened**: Rate limiting, CORS, security headers
- **Professional logging**: Structured logs with rotation
- **No external dependencies**: Complete JSON-based storage

## Development Notes

- **Language**: Spanish codebase (comments, variables, content)
- **Templates**: EJS server-side rendering with partials
- **Authentication**: JWT tokens stored in sessionStorage
- **Styling**: Subtle gray theme (#8e9196) for admin elements
- **UI/UX**: Icon-based actions, justified text, responsive design
- **No tests**: Test framework not configured (can be added)

## Key Files Structure

- **`server.js`** - Main Express server (v5.0 with security)
- **`lib/auth.js`** - JWT authentication with refresh tokens
- **`lib/validation.js`** - Joi schemas and HTML sanitization
- **`lib/logger.js`** - Winston structured logging
- **`lib/jsonStorage.js`** - Local JSON database operations
- **`admin/`** - Complete admin SPA with utilities
- **`views/`** - EJS templates with security features
- **`data/`** - JSON storage files
- **`.env`** - Environment configuration
- **`SECURITY_REPORT.md`** - Complete security implementation report

## Authentication & Security

- **JWT Authentication**: Access tokens (2h) + refresh tokens (7d)
- **Password Security**: bcrypt-ready hashing (configurable)  
- **Session Management**: Secure token storage with automatic refresh
- **Rate Limiting**: Brute force protection on login endpoint
- **Input Sanitization**: All user input validated and escaped
- **Security Headers**: Complete Helmet.js protection
- **CORS**: Configurable allowed origins for production