function validateRegisterInput(body) {

    const errors = [];

    if (
        !body.first_name ||
        body.first_name.trim() === ''
    ) {
        errors.push(
            'First name is required'
        );
    }

    if (
        !body.last_name ||
        body.last_name.trim() === ''
    ) {
        errors.push(
            'Last name is required'
        );
    }

    if (
        !body.username ||
        body.username.trim() === ''
    ) {
        errors.push(
            'Username is required'
        );
    }

    if (
        !body.email ||
        body.email.trim() === ''
    ) {
        errors.push(
            'Email is required'
        );
    }

    if (
        body.email &&
        !body.email.includes('@')
    ) {
        errors.push(
            'Invalid email format'
        );
    }

    if (
        !body.phone ||
        body.phone.trim() === ''
    ) {
        errors.push(
            'Phone number is required'
        );
    }

    if (
        !body.password ||
        body.password.length < 6
    ) {
        errors.push(
            'Password must be at least 6 characters'
        );
    }

    const accountType = String(body.account_type || '').trim().toUpperCase();
    if (!['CHECKING', 'SAVINGS', 'FIXED_DEPOSIT'].includes(accountType)) {
        errors.push('Account type is required');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateRegisterInput
};
