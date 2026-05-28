'use strict';

// Posts a route-calculation request to the SQS queue that route-optimizer
// consumes. Uses the AWS SDK v2 — yes, v3 is the supported one. Migrating
// is on the long-term list. v2 is in maintenance mode but it works fine
// for our usage and the sdk-bundling diff is non-trivial.

const AWS = require('aws-sdk');
const config = require('../config');
const { logger } = require('../middleware/requestLog');

const sqs = new AWS.SQS({ region: config.region });

const enqueueRouteCalc = (shipmentId, tenantId, accountId, callback) => {
    if (!config.sqsQueueUrl) {
        // Local dev / tests don't have a queue; no-op with a warning.
        logger.warn({ msg: 'enqueueRouteCalc: SQS_QUEUE_URL not set; skipping' });
        return callback(null, { skipped: true });
    }

    const params = {
        QueueUrl: config.sqsQueueUrl,
        MessageBody: JSON.stringify({
            shipment_id: shipmentId,
            tenant_id:   tenantId,
            account_id:  accountId,
            requested_at: new Date().toISOString(),
        }),
        MessageAttributes: {
            tenant_id:  { DataType: 'String', StringValue: String(tenantId) },
            shipment_id: { DataType: 'String', StringValue: String(shipmentId) },
        },
    };

    sqs.sendMessage(params, (err, data) => {
        if (err) {
            logger.error({ msg: 'enqueueRouteCalc failed', err: err.message });
            return callback(err);
        }
        logger.info({
            msg: 'enqueueRouteCalc ok',
            shipment_id: shipmentId,
            sqs_message_id: data.MessageId,
        });
        callback(null, data);
    });
};

module.exports = { enqueueRouteCalc };
