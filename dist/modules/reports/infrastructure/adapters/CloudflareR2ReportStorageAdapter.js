"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CloudflareR2ReportStorageAdapter", {
    enumerable: true,
    get: function() {
        return CloudflareR2ReportStorageAdapter;
    }
});
const _crypto = require("crypto");
const _axios = /*#__PURE__*/ _interop_require_default(require("axios"));
const _Result = require("../../../../shared/domain/Result");
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const aws4 = require('aws4');
let CloudflareR2ReportStorageAdapter = class CloudflareR2ReportStorageAdapter {
    async store(request) {
        if (!this.accessKeyId || !this.secretAccessKey || !this.bucketName || !this.publicUrl) {
            return _Result.Result.fail('Cloudflare R2 upload failed: configuración R2 incompleta.');
        }
        const key = this.buildObjectKey(request);
        const path = `/${this.bucketName}/${key}`;
        const payloadHash = (0, _crypto.createHash)('sha256').update(request.buffer).digest('hex');
        try {
            const signedRequest = aws4.sign({
                host: this.endpoint.host,
                method: 'PUT',
                path,
                service: 's3',
                region: 'auto',
                headers: {
                    'Content-Disposition': `attachment; filename="${request.filename}"`,
                    'Content-Length': String(request.buffer.length),
                    'Content-Type': request.mimeType,
                    'X-Amz-Content-Sha256': payloadHash
                },
                body: request.buffer
            }, {
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretAccessKey
            });
            await _axios.default.put(`${this.endpoint.origin}${path}`, request.buffer, {
                headers: signedRequest.headers,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                validateStatus: (status)=>status >= 200 && status < 300
            });
            return _Result.Result.ok({
                key,
                url: `${this.publicUrl}/${key}`
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return _Result.Result.fail(`Cloudflare R2 upload failed: ${message}`);
        }
    }
    buildObjectKey(request) {
        const ext = request.filename.includes('.') ? request.filename.split('.').pop() : 'bin';
        const safePhone = (request.phone ?? 'unknown').replace(/[^0-9a-zA-Z_-]/g, '');
        return [
            'reports',
            safePhone || 'unknown',
            `${Date.now()}-${(0, _crypto.randomUUID)()}.${ext}`
        ].join('/');
    }
    constructor(config){
        _define_property(this, "accessKeyId", void 0);
        _define_property(this, "secretAccessKey", void 0);
        _define_property(this, "bucketName", void 0);
        _define_property(this, "publicUrl", void 0);
        _define_property(this, "endpoint", void 0);
        this.accessKeyId = config.accessKeyId;
        this.secretAccessKey = config.secretAccessKey;
        this.bucketName = config.bucketName;
        this.publicUrl = config.publicUrl.replace(/\/$/, '');
        this.endpoint = new URL(`https://${config.accountId}.r2.cloudflarestorage.com`);
    }
};

//# sourceMappingURL=CloudflareR2ReportStorageAdapter.js.map