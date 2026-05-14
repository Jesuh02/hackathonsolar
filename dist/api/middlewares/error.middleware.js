"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "errorMiddleware", {
    enumerable: true,
    get: function() {
        return errorMiddleware;
    }
});
function errorMiddleware(err, _req, res, _next) {
    const statusCode = err.statusCode ?? 500;
    const isProduction = process.env.NODE_ENV === 'production';
    console.error(`[ERROR] ${err.message}`, isProduction ? '' : err.stack);
    res.status(statusCode).json({
        error: {
            message: isProduction && statusCode === 500 ? 'Error interno del servidor' : err.message,
            ...isProduction ? {} : {
                stack: err.stack
            }
        }
    });
}

//# sourceMappingURL=error.middleware.js.map