const sessionRepository =
    require('../repositories/session.repository');

const userRepository =
    require('../repositories/user.repository');

const {
    errorResponse
} = require('../utils/response');

async function requireAdmin(req, res) {

    const authHeader =
        req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {

        errorResponse(
            res,
            'Authorization required',
            401
        );

        return false;
    }

    const token =
        authHeader.replace('Bearer ', '');

    const session =
        await sessionRepository
            .findSessionByToken(token);

    if (!session) {

        errorResponse(
            res,
            'Invalid session',
            401
        );

        return false;
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
        await sessionRepository.deleteSession(token);
        errorResponse(res, 'Session expired', 401);
        return false;
    }

    const user =
        await userRepository.findUserById(
            session.user_id
        );

    if (!user || user.role !== 'ADMIN') {

        errorResponse(
            res,
            'Admin access required',
            403
        );

        return false;
    }

    req.user = user;

    return true;
}

module.exports = {
    requireAdmin
};
