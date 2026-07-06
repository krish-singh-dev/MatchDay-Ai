"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeInput = sanitizeInput;
/**
 * Sanitization middleware helper to clean text inputs.
 * Strips HTML, control characters, and enforces length constraints.
 */
function sanitizeInput(req, res, next) {
    // We will parse req.body and sanitize fields containing text (e.g. queryText or query_text)
    if (req.body) {
        for (const key of Object.keys(req.body)) {
            if (typeof req.body[key] === 'string') {
                let value = req.body[key];
                // Strip HTML-like tags
                value = value.replace(/<[^>]*>/g, '');
                // Strip control characters (except common spacing like newlines/tabs)
                value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                // Enforce max length for specific fields, like chat queries
                if (key === 'queryText' || key === 'query_text') {
                    if (value.length > 500) {
                        value = value.substring(0, 500);
                    }
                }
                req.body[key] = value.trim();
            }
        }
    }
    next();
}
