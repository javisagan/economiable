# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start server**: `npm start` - Starts the Express server on port 3000 (or PORT env var)
- **Install dependencies**: `npm install` - Install all required packages

## Environment Setup

This project requires a `.env` file with the following variables:
- `AIRTABLE_API_KEY` - API key for Airtable access (starts with "pat...")
- `AIRTABLE_BASE_ID` - Base ID from Airtable (starts with "app...")
- `AIRTABLE_TABLE_NAME` - Table name in Airtable (typically "posts")
- `ADMIN_PASSWORD` - Password for admin panel access
- `PORT` - Optional port number (defaults to 3000)

## Architecture Overview

This is a Node.js blog application that uses Airtable as a cloud database. The architecture consists of:

### Backend (server.js)
- **Express.js server** with EJS templating
- **Airtable integration** for content management
- **RESTful API** at `/api/*` endpoints for CRUD operations
- **Authentication middleware** using simple password-based auth
- **Automatic slug generation** from post titles for SEO-friendly URLs

### Frontend Structure
- **Public blog** - Server-side rendered pages using EJS templates
- **Admin panel** - Single-page application at `/admin` for content management
- **Static assets** in `/public` (CSS, images)

### Key Components
- **Slug generation**: Automatic URL-friendly slug creation from titles
- **API authentication**: Header-based auth using `ADMIN_PASSWORD`
- **Content structure**: Posts include title, subtitle, author, date, content, excerpt, tags, meta fields, and auto-generated slug

### Database Schema (Airtable)
The `posts` table contains these fields:
- `title` (Single line text) - Required
- `subtitle` (Single line text) - Optional
- `author` (Single line text)
- `date` (Date)
- `excerpt` (Long text)
- `content` (Long text)
- `imageUrl` (URL) - Optional
- `tags` (Single line text) - Comma-separated
- `metaTitle` (Single line text) - SEO
- `metaDescription` (Long text) - SEO
- `slug` (Single line text) - Auto-generated

### API Endpoints
- `POST /api/login` - Admin authentication
- `GET /api/posts` - List all posts (auth required)
- `GET /api/posts/:id` - Get single post (auth required)
- `POST /api/posts` - Create post (auth required)
- `PUT /api/posts/:id` - Update post (auth required)
- `DELETE /api/posts/:id` - Delete post (auth required)

### Frontend Routes
- `/` - Homepage with post list
- `/post/:slug` - Individual post pages
- `/suscribete` - Newsletter subscription page
- `/sobre-economiable` - About page
- `/admin` - Content management panel

## Development Notes

- The codebase is in Spanish (comments, variable names, content)
- Uses EJS for server-side rendering with partials (header/footer)
- Admin panel stores auth in sessionStorage for persistence
- No test framework is currently configured
- CSS is located in `/public/css/`
- Admin interface is a separate SPA in `/admin/` directory