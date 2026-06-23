function successResponse(
    res,
    data = null,
    message = 'Success',
    statusCode = 200
) {

    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });

    return res.end(JSON.stringify({
        success: true,
        message,
        data
    }));
}

function errorResponse(
    res,
    message = 'Something went wrong',
    statusCode = 500
) {

    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });

    return res.end(JSON.stringify({
        success: false,
        error: {
            message
        }
    }));
}

module.exports = {
    successResponse,
    errorResponse
};