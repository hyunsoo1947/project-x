'use strict';

// Centralized config. Reads env. No fancy schema validation lib — we tried
// joi once and it added 30 seconds to the cold-boot. Keep it boring.

require('dotenv').config();

const env = (k, dflt) => (process.env[k] === undefined ? dflt : process.env[k]);
const bool = (v, dflt) => {
    if (v === undefined) return dflt;
    return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};
const int = (v, dflt) => {
    if (v === undefined || v === '') return dflt;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? dflt : n;
};

const config = {
    env:       env('NODE_ENV', 'development'),
    port:      int(env('PORT'), 3000),
    logLevel:  env('LOG_LEVEL', 'info'),
    region:    env('AWS_REGION', 'us-east-1'),

    // DATABASE_URL is populated at boot from Secrets Manager (the in-container
    // bootstrap pulls routebox/<env>/DATABASE_URL). For local dev the compose
    // file sets it directly.
    databaseUrl: env('DATABASE_URL', 'postgres://routebox:routebox@postgres:5432/routebox'),

    // Internal service-to-service token (also from Secrets Manager).
    internalApiToken: env('INTERNAL_API_TOKEN', ''),

    // JWT signing key — HS256. Comes from Secrets Manager at routebox/<env>/JWT_SIGNING_KEY.
    jwtSigningKey: env('JWT_SIGNING_KEY', ''),

    // SQS queue for posting route-calc requests. The route-optimizer service
    // consumes from here. Hardcoded queue name in IAM policies — see
    // routebox-infra/cfn/iam/template.yaml.
    sqsQueueUrl: env('SQS_QUEUE_URL', ''),

    // /internal/legacy-export gate. Default true in all envs per README.
    // The data team's warehouse sync depends on this. Don't flip without
    // checking #data-platform.
    legacyExportEnabled: bool(env('LEGACY_EXPORT_ENABLED'), true),

    // Pool sizing — left at pg defaults beyond max. We've never tuned it.
    pgPoolMax: int(env('PG_POOL_MAX'), 10),
    pgIdleTimeoutMs: int(env('PG_IDLE_TIMEOUT_MS'), 30000),

    // Webhook receiver — no dedupe, see routes/webhooks.js. Body size cap
    // bumped twice over the years; one carrier sends 8MB blobs.
    webhookBodyLimit: env('WEBHOOK_BODY_LIMIT', '10mb'),
};

module.exports = config;
